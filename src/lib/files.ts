export type OutputFile = {
  name: string
  blob: Blob
  /** Size of the input this was produced from, used to show savings. */
  originalSize?: number
  note?: string
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB"]
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(value < 10 ? 2 : 1)} ${units[i]}`
}

export function baseName(name: string): string {
  const dot = name.lastIndexOf(".")
  return dot > 0 ? name.slice(0, dot) : name
}

export function withExt(name: string, ext: string): string {
  return `${baseName(name)}.${ext}`
}

/** Wraps bytes from libraries (pdf-lib, fflate, ...) whose typings use ArrayBufferLike. */
export function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type })
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function matchesAccept(file: File, accept: string): boolean {
  if (!accept) return true
  const name = file.name.toLowerCase()
  return accept
    .split(",")
    .map((rule) => rule.trim().toLowerCase())
    .some((rule) => {
      if (rule.startsWith(".")) return name.endsWith(rule)
      if (rule.endsWith("/*")) return file.type.startsWith(rule.slice(0, -1))
      return file.type === rule
    })
}

/** Returns `name`, or `name (2)`, `name (3)`... so archive entries never collide. */
function uniqueName(taken: Set<string>, name: string): string {
  let candidate = name
  for (let n = 2; taken.has(candidate); n++) {
    const dot = name.lastIndexOf(".")
    candidate = dot > 0 ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`
  }
  taken.add(candidate)
  return candidate
}

export type ZipLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export async function zipFiles(files: { name: string; blob: Blob }[], level: ZipLevel = 6): Promise<Blob> {
  const { zip } = await import("fflate")
  const taken = new Set<string>()
  const entries: Record<string, Uint8Array> = {}
  for (const file of files) {
    entries[uniqueName(taken, file.name)] = new Uint8Array(await file.blob.arrayBuffer())
  }
  const data = await new Promise<Uint8Array>((resolve, reject) =>
    zip(entries, { level }, (err, out) => (err ? reject(err) : resolve(out)))
  )
  return bytesToBlob(data, "application/zip")
}
