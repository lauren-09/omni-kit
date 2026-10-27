import { useState } from "react"
import { ImagePlay } from "lucide-react"
import { FilePicker } from "@/components/file-picker"
import { ResultList } from "@/components/result-list"
import { Field, OptionsCard, ProgressPanel, RunButton } from "@/components/tool-parts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { useTask } from "@/hooks/use-task"
import { bytesToBlob, type OutputFile } from "@/lib/files"
import { canvasToBlob, decodeImage, fitWithin, IMAGE_ACCEPT } from "@/lib/image"
import { cancelFFmpeg, openSession } from "@/lib/media/ffmpeg"
import { framesToGifArgs } from "@/lib/media/formats"

export default function ImagesToGif() {
  const [files, setFiles] = useState<File[]>([])
  const [delay, setDelay] = useState(500)
  const [width, setWidth] = useState("480")
  const [results, setResults] = useState<OutputFile[] | null>(null)
  const { busy, progress, run } = useTask()

  const create = () =>
    run(async (report) => {
      const session = await openSession(report)
      try {
        // Every frame gets the first image's proportions; others are centred on white.
        const first = await decodeImage(files[0])
        const size = fitWithin(first.width, first.height, Number(width), Number(width) * 4)
        first.close()
        const canvas = document.createElement("canvas")
        canvas.width = size.width
        canvas.height = size.height
        const ctx = canvas.getContext("2d")!

        for (const [i, file] of files.entries()) {
          report((i / files.length) * 0.7, `Preparing frame ${i + 1} of ${files.length}…`)
          const image = await decodeImage(file)
          const fit = fitWithin(image.width, image.height, size.width, size.height)
          ctx.fillStyle = "#ffffff"
          ctx.fillRect(0, 0, size.width, size.height)
          ctx.drawImage(image.source, (size.width - fit.width) / 2, (size.height - fit.height) / 2, fit.width, fit.height)
          image.close()
          await session.write(`frame-${String(i).padStart(3, "0")}.png`, await canvasToBlob(canvas, "image/png"))
        }
        report(0.75, "Creating GIF…")
        await session.exec(framesToGifArgs("frame-%03d.png", "output.gif", delay))
        const blob = bytesToBlob(await session.read("output.gif"), "image/gif")
        setResults([{ name: "animation.gif", blob, note: `${files.length} frames · ${delay / 1000}s each` }])
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
        onChange={setFiles}
        accept={IMAGE_ACCEPT}
        hint="Two or more images · each becomes a frame, in the order shown"
        multiple
        reorderable
        disabled={busy}
      />
      <OptionsCard>
        <Field label="Time per frame" value={`${(delay / 1000).toFixed(1)}s`}>
          <Slider min={100} max={3000} step={100} value={[delay]} onValueChange={([v]) => setDelay(v)} />
        </Field>
        <Field label="Width" htmlFor="gif-width">
          <Select value={width} onValueChange={setWidth}>
            <SelectTrigger id="gif-width" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="320">320 px</SelectItem>
              <SelectItem value="480">480 px</SelectItem>
              <SelectItem value="640">640 px</SelectItem>
              <SelectItem value="800">800 px</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </OptionsCard>
      <div>
        <RunButton busy={busy} disabled={files.length < 2} onClick={create} icon={<ImagePlay />}>
          Create GIF
        </RunButton>
      </div>
      <ProgressPanel progress={progress} onCancel={cancelFFmpeg} />
    </div>
  )
}
