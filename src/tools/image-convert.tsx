import { useState } from "react"
import { Repeat2 } from "lucide-react"
import { FilePicker } from "@/components/file-picker"
import { ResultList } from "@/components/result-list"
import { Field, OptionsCard, ProgressPanel, RunButton } from "@/components/tool-parts"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTask } from "@/hooks/use-task"
import { withExt, type OutputFile } from "@/lib/files"
import { encodeIco, encodeImage, FORMAT_EXT, FORMAT_LABEL, IMAGE_ACCEPT, type ImageFormat } from "@/lib/image"

export type ImageTarget = ImageFormat | "image/x-icon"

const TARGETS: ImageTarget[] = ["image/png", "image/jpeg", "image/webp", "image/x-icon"]
const LABEL: Record<ImageTarget, string> = { ...FORMAT_LABEL, "image/x-icon": "ICO" }
const EXT: Record<ImageTarget, string> = { ...FORMAT_EXT, "image/x-icon": "ico" }

const isSvg = (file: File) => file.type === "image/svg+xml" || /\.svg$/i.test(file.name)

type ImageConvertProps = {
  accept?: string
  hint?: string
  defaultTarget?: ImageTarget
}

export default function ImageConvert({
  accept = IMAGE_ACCEPT,
  hint = "JPG, PNG, WebP, HEIC, JFIF, GIF, BMP, SVG, AVIF",
  defaultTarget = "image/png",
}: ImageConvertProps) {
  const [files, setFiles] = useState<File[]>([])
  const [target, setTarget] = useState<ImageTarget>(defaultTarget)
  const [quality, setQuality] = useState(90)
  const [background, setBackground] = useState("#ffffff")
  const [svgScale, setSvgScale] = useState("2")
  const [results, setResults] = useState<OutputFile[] | null>(null)
  const { busy, progress, run } = useTask()
  const hasSvg = files.some(isSvg)

  const convert = () =>
    run(async (report) => {
      const out: OutputFile[] = []
      for (const [i, file] of files.entries()) {
        report(i / files.length, `Converting ${file.name} (${i + 1}/${files.length})`)
        const scale = isSvg(file) ? Number(svgScale) : 1
        const blob =
          target === "image/x-icon"
            ? await encodeIco(file)
            : await encodeImage(file, {
                type: target,
                quality: quality / 100,
                background: target === "image/jpeg" ? background : undefined,
                resize: scale === 1 ? undefined : (w, h) => ({ width: Math.round(w * scale), height: Math.round(h * scale) }),
              })
        out.push({ name: withExt(file.name, EXT[target]), blob, originalSize: file.size })
      }
      setResults(out)
    })

  if (results) {
    return (
      <ResultList
        files={results}
        zipName={`converted-${EXT[target]}.zip`}
        checkerboard={target !== "image/jpeg"}
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
        <Field
          label="Convert to"
          className="grid gap-2 sm:col-span-2"
          hint={target === "image/x-icon" ? "Website favicon with 16 to 256 px sizes in one file." : undefined}
        >
          <Tabs value={target} onValueChange={(v) => setTarget(v as ImageTarget)}>
            <TabsList>
              {TARGETS.map((format) => (
                <TabsTrigger key={format} value={format} className="px-4">
                  {LABEL[format]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </Field>
        {(target === "image/jpeg" || target === "image/webp") && (
          <Field label="Quality" value={`${quality}%`}>
            <Slider min={10} max={100} step={1} value={[quality]} onValueChange={([v]) => setQuality(v)} />
          </Field>
        )}
        {target === "image/jpeg" && (
          <Field label="Fill transparent areas with" htmlFor="bg" hint="JPG has no transparency.">
            <div className="flex items-center gap-2">
              <Input
                id="bg"
                type="color"
                value={background}
                onChange={(e) => setBackground(e.target.value)}
                className="h-8 w-12 cursor-pointer p-1"
              />
              <span className="font-mono text-sm text-muted-foreground uppercase">{background}</span>
            </div>
          </Field>
        )}
        {hasSvg && target !== "image/x-icon" && (
          <Field label="SVG output size" htmlFor="svg-scale" hint="SVGs are vectors, so they stay sharp at any size.">
            <Select value={svgScale} onValueChange={setSvgScale}>
              <SelectTrigger id="svg-scale" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1× (original size)</SelectItem>
                <SelectItem value="2">2× (retina)</SelectItem>
                <SelectItem value="4">4×</SelectItem>
                <SelectItem value="8">8× (print)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}
      </OptionsCard>
      <div>
        <RunButton busy={busy} disabled={files.length === 0} onClick={convert} icon={<Repeat2 />}>
          Convert to {LABEL[target]}
        </RunButton>
      </div>
      <ProgressPanel progress={progress} />
    </div>
  )
}
