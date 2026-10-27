import { useState } from "react"
import { ImageDown } from "lucide-react"
import { FilePicker } from "@/components/file-picker"
import { ResultList } from "@/components/result-list"
import { Field, OptionsCard, ProgressPanel, RunButton } from "@/components/tool-parts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { useTask } from "@/hooks/use-task"
import { withExt, type OutputFile } from "@/lib/files"
import { encodableFormat, encodeImage, fitWithin, FORMAT_EXT, IMAGE_ACCEPT, type ImageFormat } from "@/lib/image"

type OutputMode = "original" | ImageFormat

export default function ImageCompress() {
  const [files, setFiles] = useState<File[]>([])
  const [quality, setQuality] = useState(70)
  const [maxSize, setMaxSize] = useState("0")
  const [format, setFormat] = useState<OutputMode>("original")
  const [results, setResults] = useState<OutputFile[] | null>(null)
  const { busy, progress, run } = useTask()

  const compress = () =>
    run(async (report) => {
      const max = Number(maxSize)
      const out: OutputFile[] = []
      for (const [i, file] of files.entries()) {
        report(i / files.length, `Compressing ${file.name} (${i + 1}/${files.length})`)
        const type = format === "original" ? encodableFormat(file) : format
        const blob = await encodeImage(file, {
          type,
          quality: quality / 100,
          resize: max ? (w, h) => fitWithin(w, h, max, max) : undefined,
        })
        // Re-encoding an already optimized file can make it bigger; never hand that back.
        if (blob.size >= file.size && type === file.type && !max) {
          out.push({ name: file.name, blob: file, originalSize: file.size, note: "Already optimized, kept original" })
        } else {
          out.push({ name: withExt(file.name, FORMAT_EXT[type]), blob, originalSize: file.size })
        }
      }
      setResults(out)
    })

  if (results) {
    return (
      <ResultList
        files={results}
        zipName="compressed-images.zip"
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
        hint="JPG, PNG, WebP, HEIC, GIF, BMP · as many as you like"
        multiple
        disabled={busy}
      />
      <OptionsCard>
        <Field label="Quality" value={`${quality}%`} hint="60–80% looks identical to most people and saves the most.">
          <Slider min={10} max={100} step={1} value={[quality]} onValueChange={([v]) => setQuality(v)} />
        </Field>
        <Field label="Output format" htmlFor="format" hint="PNG is lossless. Pick WebP to shrink PNGs and keep transparency.">
          <Select value={format} onValueChange={(v) => setFormat(v as OutputMode)}>
            <SelectTrigger id="format" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="original">Same as original</SelectItem>
              <SelectItem value="image/jpeg">JPG (smallest for photos)</SelectItem>
              <SelectItem value="image/webp">WebP (small, keeps transparency)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Maximum dimensions" htmlFor="max-size" hint="Downscaling large photos gives the biggest savings.">
          <Select value={maxSize} onValueChange={setMaxSize}>
            <SelectTrigger id="max-size" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Keep original size</SelectItem>
              <SelectItem value="3840">3840 px (4K)</SelectItem>
              <SelectItem value="2560">2560 px</SelectItem>
              <SelectItem value="1920">1920 px (Full HD)</SelectItem>
              <SelectItem value="1280">1280 px (web)</SelectItem>
              <SelectItem value="800">800 px (email)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </OptionsCard>
      <div>
        <RunButton busy={busy} disabled={files.length === 0} onClick={compress} icon={<ImageDown />}>
          Compress {files.length > 1 ? `${files.length} images` : "image"}
        </RunButton>
      </div>
      <ProgressPanel progress={progress} />
    </div>
  )
}
