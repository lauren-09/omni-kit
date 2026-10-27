import { useState } from "react"
import { Info, Shrink } from "lucide-react"
import { FilePicker } from "@/components/file-picker"
import { ResultList } from "@/components/result-list"
import { Field, OptionsCard, ProgressPanel, RunButton } from "@/components/tool-parts"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTask } from "@/hooks/use-task"
import { bytesToBlob, withExt, type OutputFile } from "@/lib/files"
import { cancelFFmpeg, openSession } from "@/lib/media/ffmpeg"
import { compressVideoArgs, extOf, formatDuration, MEDIA_ACCEPT, type CompressLevel } from "@/lib/media/formats"

type Mode = "quality" | "size"

const MB = 1024 * 1024
/** Below this the picture falls apart, so ask for a bigger target instead. */
const MIN_VIDEO_KBPS = 100

/** Average video bitrate that lands near `targetBytes`, leaving headroom for overshoot and the container. */
function videoKbpsFor(targetBytes: number, seconds: number, audioKbps: number) {
  return Math.floor((targetBytes * 0.92 * 8) / 1000 / seconds - audioKbps)
}

export default function VideoCompress() {
  const [files, setFiles] = useState<File[]>([])
  const [mode, setMode] = useState<Mode>("quality")
  const [level, setLevel] = useState<CompressLevel>("balanced")
  const [targetMb, setTargetMb] = useState(25)
  const [resolution, setResolution] = useState("0")
  const [keepAudio, setKeepAudio] = useState(true)
  const [results, setResults] = useState<OutputFile[] | null>(null)
  const { busy, progress, run } = useTask()

  const compress = () =>
    run(async (report) => {
      const session = await openSession(report)
      const targetBytes = targetMb * MB
      const out: OutputFile[] = []
      try {
        for (const [i, file] of files.entries()) {
          if (mode === "size" && file.size <= targetBytes) {
            out.push({ name: file.name, blob: file, originalSize: file.size, note: `Already under ${targetMb} MB, kept original` })
            continue
          }
          const label = `Compressing ${file.name} (${i + 1}/${files.length})`
          const onProgress = (f: number) => report((i + f) / files.length, label)
          onProgress(0)
          const input = `input-${i}.${extOf(file.name)}`
          const output = `output-${i}.mp4`
          await session.write(input, file)
          const info = await session.probe(input)
          if (!info.video) throw new Error(`${file.name} has no video track.`)

          const audioKbps = keepAudio ? (mode === "size" ? 96 : 128) : null
          let videoKbps: number | null = null
          if (mode === "size") {
            if (!info.duration) throw new Error(`Couldn't read the length of ${file.name}, so it can't be fitted to a size. Try "By quality".`)
            videoKbps = videoKbpsFor(targetBytes, info.duration, audioKbps ?? 0)
            if (videoKbps < MIN_VIDEO_KBPS) {
              throw new Error(`${file.name} is ${formatDuration(info.duration)} long, too long to fit in ${targetMb} MB. Pick a bigger target size.`)
            }
          }

          await session.exec(compressVideoArgs(input, output, { level, videoKbps, maxHeight: Number(resolution) || null, audioKbps }), {
            duration: info.duration,
            onProgress,
          })
          const blob = bytesToBlob(await session.read(output), "video/mp4")
          // Re-encoding an already efficient video can make it bigger; never hand that back.
          if (blob.size >= file.size) {
            out.push({ name: file.name, blob: file, originalSize: file.size, note: "Already well compressed, kept original" })
          } else {
            out.push({ name: withExt(file.name, "mp4"), blob, originalSize: file.size, note: info.duration ? formatDuration(info.duration) : undefined })
          }
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
        zipName="compressed-videos.zip"
        onReset={() => {
          setResults(null)
          setFiles([])
        }}
      />
    )
  }

  return (
    <div className="grid gap-6">
      <FilePicker files={files} onChange={setFiles} accept={MEDIA_ACCEPT.video} hint="MP4, MOV, WebM, MKV, AVI and more" multiple disabled={busy} />
      <OptionsCard>
        <Field label="Compress by" className="grid gap-2 sm:col-span-2">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="quality">Quality</TabsTrigger>
              <TabsTrigger value="size">File size</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        {mode === "quality" ? (
          <Field label="Compression" hint="Balanced roughly halves most phone videos with little visible change.">
            <Tabs value={level} onValueChange={(v) => setLevel(v as CompressLevel)}>
              <TabsList>
                <TabsTrigger value="light">Light</TabsTrigger>
                <TabsTrigger value="balanced">Balanced</TabsTrigger>
                <TabsTrigger value="strong">Strong</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        ) : (
          <Field label="Target size (MB)" htmlFor="target-size" hint="Each video aims just under this, e.g. 10 MB for Discord or 25 MB for email.">
            <Input
              id="target-size"
              type="number"
              min={1}
              step={1}
              value={targetMb}
              onChange={(e) => setTargetMb(Math.max(1, Number(e.target.value) || 1))}
            />
          </Field>
        )}
        <Field label="Resolution" htmlFor="resolution" hint="Lowering resolution gives the biggest savings.">
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
        <Field label="Keep audio" htmlFor="keep-audio" hint="Turn off for silent clips to save a little more.">
          <Switch id="keep-audio" checked={keepAudio} onCheckedChange={setKeepAudio} />
        </Field>
      </OptionsCard>
      <Alert>
        <Info />
        <AlertDescription>
          Videos are compressed on your own device and saved as MP4. Expect roughly real time for HD clips. Files over about 1 GB may not fit in
          browser memory.
        </AlertDescription>
      </Alert>
      <div>
        <RunButton busy={busy} disabled={files.length === 0} onClick={compress} icon={<Shrink />}>
          Compress {files.length > 1 ? `${files.length} videos` : "video"}
        </RunButton>
      </div>
      <ProgressPanel progress={progress} onCancel={cancelFFmpeg} />
    </div>
  )
}
