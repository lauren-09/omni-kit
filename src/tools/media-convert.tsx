import { useState } from "react"
import { Info, RefreshCw } from "lucide-react"
import { FilePicker } from "@/components/file-picker"
import { ResultList } from "@/components/result-list"
import { Field, OptionsCard, ProgressPanel, RunButton } from "@/components/tool-parts"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTask } from "@/hooks/use-task"
import { bytesToBlob, withExt, type OutputFile } from "@/lib/files"
import { cancelFFmpeg, openSession } from "@/lib/media/ffmpeg"
import {
  AUDIO_TARGETS,
  audioArgs,
  canCopyStreams,
  extOf,
  formatDuration,
  VIDEO_TARGETS,
  videoArgs,
  type AudioTarget,
  type VideoQuality,
  type VideoTarget,
} from "@/lib/media/formats"

type MediaConvertProps =
  | { kind: "video"; accept: string; hint: string; defaultTarget: VideoTarget }
  | { kind: "audio"; accept: string; hint: string; defaultTarget: AudioTarget }

export default function MediaConvert(props: MediaConvertProps) {
  const { kind, accept, hint } = props
  const [files, setFiles] = useState<File[]>([])
  const [target, setTarget] = useState<string>(props.defaultTarget)
  const [quality, setQuality] = useState<VideoQuality>("balanced")
  const [resolution, setResolution] = useState("0")
  const [bitrate, setBitrate] = useState("192")
  const [results, setResults] = useState<OutputFile[] | null>(null)
  const { busy, progress, run } = useTask()

  const targets = kind === "video" ? VIDEO_TARGETS : AUDIO_TARGETS
  const audioTarget = AUDIO_TARGETS[target as AudioTarget]

  const convert = () =>
    run(async (report) => {
      const session = await openSession(report)
      const out: OutputFile[] = []
      try {
        for (const [i, file] of files.entries()) {
          const label = `Converting ${file.name} (${i + 1}/${files.length})`
          const onProgress = (f: number) => report((i + f) / files.length, label)
          onProgress(0)
          const input = `input-${i}.${extOf(file.name)}`
          const output = `output-${i}.${target}`
          await session.write(input, file)
          const info = await session.probe(input)

          let copied = false
          if (kind === "video") {
            if (!info.video) throw new Error(`${file.name} has no video track.`)
            const maxHeight = Number(resolution) || null
            copied = canCopyStreams(target as VideoTarget, info, maxHeight)
            const args = (copy: boolean) => videoArgs(input, output, target as VideoTarget, quality, maxHeight, copy)
            try {
              await session.exec(args(copied), { duration: info.duration, onProgress })
            } catch (err) {
              // Stream copy can fail on unusual files; fall back to a full re-encode.
              if (!copied || (err instanceof Error && err.name === "AbortError")) throw err
              copied = false
              await session.exec(args(false), { duration: info.duration, onProgress })
            }
          } else {
            if (!info.audio) throw new Error(`${file.name} has no audio track.`)
            await session.exec(audioArgs(input, output, target as AudioTarget, Number(bitrate)), { duration: info.duration, onProgress })
          }

          const mime = kind === "video" ? VIDEO_TARGETS[target as VideoTarget].mime : AUDIO_TARGETS[target as AudioTarget].mime
          out.push({
            name: withExt(file.name, target),
            blob: bytesToBlob(await session.read(output), mime),
            originalSize: file.size,
            note: [info.duration ? formatDuration(info.duration) : "", copied ? "no quality loss (re-packaged)" : ""].filter(Boolean).join(" · "),
          })
          await session.dispose()
        }
        setResults(out)
      } finally {
        await session.dispose()
      }
    })

  if (results) {
    return (
      <ResultList
        files={results}
        zipName={`converted-${target}.zip`}
        onReset={() => {
          setResults(null)
          setFiles([])
        }}
      />
    )
  }

  return (
    <div className="grid gap-6">
      <FilePicker files={files} onChange={setFiles} accept={accept} hint={hint} multiple disabled={busy} />
      <OptionsCard>
        <Field label="Convert to" htmlFor="target">
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger id="target" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(targets).map(([key, t]) => (
                <SelectItem key={key} value={key}>
                  {t.label} <span className="text-muted-foreground">· {t.detail}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {kind === "video" ? (
          <>
            <Field label="Resolution" htmlFor="resolution">
              <Select value={resolution} onValueChange={setResolution}>
                <SelectTrigger id="resolution" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Keep original</SelectItem>
                  <SelectItem value="1080">1080p (Full HD)</SelectItem>
                  <SelectItem value="720">720p (HD)</SelectItem>
                  <SelectItem value="480">480p (small)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Quality" hint="Only used when the video has to be re-encoded.">
              <Tabs value={quality} onValueChange={(v) => setQuality(v as VideoQuality)}>
                <TabsList>
                  <TabsTrigger value="high">High</TabsTrigger>
                  <TabsTrigger value="balanced">Balanced</TabsTrigger>
                  <TabsTrigger value="small">Small file</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
          </>
        ) : (
          !audioTarget?.lossless && (
            <Field label="Bitrate" htmlFor="bitrate" hint="192 kbps sounds identical to the original for most people.">
              <Select value={bitrate} onValueChange={setBitrate}>
                <SelectTrigger id="bitrate" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="128">128 kbps (smaller)</SelectItem>
                  <SelectItem value="192">192 kbps (recommended)</SelectItem>
                  <SelectItem value="256">256 kbps</SelectItem>
                  <SelectItem value="320">320 kbps (best)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )
        )}
      </OptionsCard>
      <Alert>
        <Info />
        <AlertDescription>
          {kind === "video"
            ? "Video is processed on your own device, so it's slower than desktop apps. Expect roughly real time for HD clips. Files over about 1 GB may not fit in browser memory."
            : "Audio is processed on your own device. The first conversion downloads the media engine (about 30 MB), then it's cached."}
        </AlertDescription>
      </Alert>
      <div>
        <RunButton busy={busy} disabled={files.length === 0} onClick={convert} icon={<RefreshCw />}>
          Convert to {(kind === "video" ? VIDEO_TARGETS[target as VideoTarget] : AUDIO_TARGETS[target as AudioTarget]).label.split(" ")[0]}
        </RunButton>
      </div>
      <ProgressPanel progress={progress} onCancel={cancelFFmpeg} />
    </div>
  )
}
