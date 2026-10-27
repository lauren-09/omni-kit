import { useMemo, useRef, useState } from "react"
import { Film } from "lucide-react"
import { FilePicker } from "@/components/file-picker"
import { ResultList } from "@/components/result-list"
import { Field, OptionsCard, ProgressPanel, RunButton } from "@/components/tool-parts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useObjectUrls } from "@/hooks/use-object-urls"
import { useTask } from "@/hooks/use-task"
import { bytesToBlob, withExt, type OutputFile } from "@/lib/files"
import { cancelFFmpeg, openSession } from "@/lib/media/ffmpeg"
import { MEDIA_ACCEPT, videoToGifArgs } from "@/lib/media/formats"

const MAX_SECONDS = 30

export default function VideoToGif({ accept = MEDIA_ACCEPT.video, hint = "MP4, WebM, MOV, AVI, MKV" }: { accept?: string; hint?: string }) {
  const [files, setFiles] = useState<File[]>([])
  const [start, setStart] = useState(0)
  const [length, setLength] = useState(5)
  const [fps, setFps] = useState("12")
  const [width, setWidth] = useState("480")
  const [videoDuration, setVideoDuration] = useState<number | null>(null)
  const [canPreview, setCanPreview] = useState(true)
  const [results, setResults] = useState<OutputFile[] | null>(null)
  const { busy, progress, run } = useTask()
  const video = useRef<HTMLVideoElement>(null)
  const file = files[0]
  const [previewUrl] = useObjectUrls(useMemo(() => [file], [file]))

  const create = () =>
    run(async (report) => {
      const session = await openSession(report)
      try {
        const input = `input.${file.name.split(".").pop() ?? "mp4"}`
        await session.write(input, file)
        report(0, "Creating GIF…")
        await session.exec(
          videoToGifArgs(input, "output.gif", { start, duration: length, fps: Number(fps), width: Number(width) || null }),
          { duration: length, onProgress: (f) => report(f, "Creating GIF…") }
        )
        const blob = bytesToBlob(await session.read("output.gif"), "image/gif")
        setResults([{ name: withExt(file.name, "gif"), blob, note: `${length}s · ${fps} fps${Number(width) ? ` · ${width}px wide` : ""}` }])
      } finally {
        await session.dispose()
      }
    })

  if (results) {
    return (
      <ResultList
        files={results}
        onReset={() => {
          setResults(null)
          setFiles([])
        }}
      />
    )
  }

  return (
    <div className="grid gap-6">
      <FilePicker
        files={files}
        onChange={(next) => {
          setFiles(next)
          setStart(0)
          setVideoDuration(null)
          setCanPreview(true)
        }}
        accept={accept}
        hint={`${hint} · one video`}
        disabled={busy}
      />
      {file && previewUrl && canPreview && (
        <video
          ref={video}
          src={previewUrl}
          controls
          muted
          className="max-h-80 w-full rounded-xl border bg-black"
          onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration)}
          // AVI, MKV and other formats often can't play in the browser, but can still be converted.
          onError={() => setCanPreview(false)}
        />
      )}
      <OptionsCard>
        <Field label="Start at (seconds)" htmlFor="start" hint={videoDuration ? `Video is ${videoDuration.toFixed(1)}s long.` : undefined}>
          <div className="flex gap-2">
            <Input
              id="start"
              type="number"
              min={0}
              step={0.1}
              value={start}
              onChange={(e) => setStart(Math.max(0, Number(e.target.value) || 0))}
            />
            {canPreview && file && (
              <Button variant="outline" onClick={() => setStart(Number((video.current?.currentTime ?? 0).toFixed(1)))}>
                Use current frame
              </Button>
            )}
          </div>
        </Field>
        <Field label="Length" value={`${length}s`} hint="Long GIFs get very large. Keep it short.">
          <Slider min={1} max={MAX_SECONDS} step={1} value={[length]} onValueChange={([v]) => setLength(v)} />
        </Field>
        <Field label="Frame rate">
          <Tabs value={fps} onValueChange={setFps}>
            <TabsList>
              <TabsTrigger value="8">8 fps</TabsTrigger>
              <TabsTrigger value="12">12 fps</TabsTrigger>
              <TabsTrigger value="20">20 fps</TabsTrigger>
              <TabsTrigger value="25">25 fps</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Field label="Width" htmlFor="width">
          <Select value={width} onValueChange={setWidth}>
            <SelectTrigger id="width" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="320">320 px (small)</SelectItem>
              <SelectItem value="480">480 px (recommended)</SelectItem>
              <SelectItem value="640">640 px</SelectItem>
              <SelectItem value="800">800 px</SelectItem>
              <SelectItem value="0">Original size</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </OptionsCard>
      <div>
        <RunButton busy={busy} disabled={!file} onClick={create} icon={<Film />}>
          Create GIF
        </RunButton>
      </div>
      <ProgressPanel progress={progress} onCancel={cancelFFmpeg} />
    </div>
  )
}
