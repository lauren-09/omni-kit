import type { FFmpeg, LogEvent } from "@ffmpeg/ffmpeg"
import type { Report } from "@/hooks/use-task"

/**
 * ffmpeg.wasm core, pinned to the version @ffmpeg/ffmpeg 0.12.x expects. Served from a CDN because the
 * 32 MB WebAssembly file is over Cloudflare Pages' 25 MiB per-file limit.
 * Browsers cache it, so later visits start instantly. Files are never sent anywhere.
 */
const CORE_BASE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm"

/**
 * SHA-256 of the official npm release files. Code from the CDN runs inside our origin,
 * so a tampered or swapped file must be refused rather than executed.
 */
const CORE_INTEGRITY = {
  js: "Z6SPEWRfhUOfP95PIRkELBazdLkQIGt6eiTzQuKNyuM=",
  wasm: "n1eUelvVMNjwDFs/LLKjSS+qfl2CMxU0LWqGVtCmt7c=",
}

let instance: Promise<FFmpeg> | null = null
let cancelled = false

async function sha256(blob: Blob): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()))
  return btoa(String.fromCharCode(...digest))
}

/**
 * Downloads to a same-origin blob: URL (required to start the engine's worker), after
 * verifying its hash. Not using @ffmpeg/util's toBlobURL: it treats Content-Length as exact,
 * but CDNs report the compressed size, so its check fails and it then re-reads a consumed body.
 */
async function toBlobUrl(url: string, type: string, integrity: string, onProgress?: (fraction: number) => void): Promise<string> {
  const response = await fetch(url).catch(() => null)
  if (!response?.ok || !response.body) {
    throw new Error("Couldn't download the media engine. Check your internet connection and try again.")
  }
  const total = Number(response.headers.get("Content-Length")) || 0
  const reader = response.body.getReader()
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.length
    if (total) onProgress?.(Math.min(0.99, received / total))
  }
  const blob = new Blob(chunks, { type })
  if ((await sha256(blob)) !== integrity) {
    throw new Error("The downloaded media engine failed its security check, so it wasn't run. Please try again later.")
  }
  return URL.createObjectURL(blob)
}

function load(report: Report): Promise<FFmpeg> {
  instance ??= (async () => {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg")
    const ffmpeg = new FFmpeg()
    const [coreURL, wasmURL] = await Promise.all([
      toBlobUrl(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript", CORE_INTEGRITY.js),
      toBlobUrl(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm", CORE_INTEGRITY.wasm, (f) =>
        report(f, "Downloading media engine (one time only, then cached)…")
      ),
    ])
    report(1, "Starting media engine…")
    await ffmpeg.load({ coreURL, wasmURL })
    return ffmpeg
  })().catch((err) => {
    instance = null
    throw err
  })
  return instance
}

/** Stops the running conversion. The engine reloads (from cache) on next use. */
export function cancelFFmpeg() {
  if (!instance) return
  cancelled = true
  void instance.then((ffmpeg) => ffmpeg.terminate()).catch(() => undefined)
  instance = null
}

function abortError() {
  const err = new Error("Cancelled.")
  err.name = "AbortError"
  return err
}

export type MediaInfo = {
  /** Seconds; 0 when unknown (e.g. still images). */
  duration: number
  video?: string
  audio?: string
  width?: number
  height?: number
}

const toSeconds = (h: string, m: string, s: string) => Number(h) * 3600 + Number(m) * 60 + Number(s)

export type Session = {
  write: (name: string, data: Blob) => Promise<void>
  probe: (name: string) => Promise<MediaInfo>
  /** Runs ffmpeg; `duration` (seconds) turns its log output into progress. */
  exec: (args: string[], progress?: { duration: number; onProgress: (fraction: number) => void }) => Promise<void>
  read: (name: string) => Promise<Uint8Array>
  /** Frees every file written or produced in this session. */
  dispose: () => Promise<void>
}

export async function openSession(report: Report): Promise<Session> {
  cancelled = false
  report(0, "Starting media engine…")
  const ffmpeg = await load(report)
  const files = new Set<string>()

  async function run(args: string[], onLog?: (message: string) => void): Promise<{ code: number; logs: string[] }> {
    const logs: string[] = []
    const listener = ({ message }: LogEvent) => {
      logs.push(message)
      if (logs.length > 200) logs.shift()
      onLog?.(message)
    }
    ffmpeg.on("log", listener)
    try {
      const code = await ffmpeg.exec(["-hide_banner", "-nostdin", ...args])
      return { code, logs }
    } catch (err) {
      if (cancelled) throw abortError()
      // A WebAssembly crash leaves the engine unusable, so start a fresh one next time.
      console.error(err, logs.join("\n"))
      ffmpeg.terminate()
      instance = null
      throw new Error("The media engine crashed on this file. Try a different output format or a smaller file.")
    } finally {
      ffmpeg.off("log", listener)
    }
  }

  return {
    async write(name, data) {
      await ffmpeg.writeFile(name, new Uint8Array(await data.arrayBuffer()))
      files.add(name)
    },

    async probe(name) {
      // With no output file ffmpeg just prints the stream info and exits with an error code.
      const { logs } = await run(["-i", name])
      const text = logs.join("\n")
      const duration = text.match(/Duration: (\d+):(\d+):([\d.]+)/)
      const video = text.match(/Stream #.*?Video: (\w+).*?, (\d{2,5})x(\d{2,5})/)
      const audio = text.match(/Stream #.*?Audio: (\w+)/)
      return {
        duration: duration ? toSeconds(duration[1], duration[2], duration[3]) : 0,
        video: video?.[1],
        width: video ? Number(video[2]) : undefined,
        height: video ? Number(video[3]) : undefined,
        audio: audio?.[1],
      }
    },

    async exec(args, progress) {
      const output = args.at(-1)!
      files.add(output)
      const { code, logs } = await run(args, (message) => {
        const time = progress && message.match(/time=(\d+):(\d+):([\d.]+)/)
        if (time && progress.duration > 0) {
          progress.onProgress(Math.min(1, toSeconds(time[1], time[2], time[3]) / progress.duration))
        }
      })
      if (cancelled) throw abortError()
      if (code !== 0) {
        console.error(logs.join("\n"))
        const reason = [...logs].reverse().find((line) => /error|invalid|not supported|unknown/i.test(line))
        throw new Error(`Conversion failed${reason ? `: ${reason.trim()}` : "."} This file may use an unsupported codec.`)
      }
    },

    async read(name) {
      const data = await ffmpeg.readFile(name)
      if (typeof data === "string") throw new Error("Unexpected text output.")
      return data
    },

    async dispose() {
      if (cancelled) return
      await Promise.all([...files].map((name) => ffmpeg.deleteFile(name).catch(() => undefined)))
      files.clear()
    },
  }
}
