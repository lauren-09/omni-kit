import { useState } from "react"
import { Scaling } from "lucide-react"
import { FilePicker } from "@/components/file-picker"
import { ResultList } from "@/components/result-list"
import { Field, OptionsCard, ProgressPanel, RunButton } from "@/components/tool-parts"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTask } from "@/hooks/use-task"
import { baseName, type OutputFile } from "@/lib/files"
import { encodableFormat, encodeImage, FORMAT_EXT, IMAGE_ACCEPT } from "@/lib/image"

type Size = { width: number; height: number }

export default function ImageResize() {
  const [files, setFiles] = useState<File[]>([])
  const [mode, setMode] = useState<"percent" | "pixels">("percent")
  const [percent, setPercent] = useState(50)
  const [width, setWidth] = useState("")
  const [height, setHeight] = useState("")
  const [keepAspect, setKeepAspect] = useState(true)
  const [results, setResults] = useState<OutputFile[] | null>(null)
  const { busy, progress, run } = useTask()

  const targetWidth = Number(width) || 0
  const targetHeight = Number(height) || 0
  const valid = mode === "percent" || targetWidth > 0 || targetHeight > 0

  function targetSize(w: number, h: number): Size {
    if (mode === "percent") {
      return { width: Math.max(1, Math.round((w * percent) / 100)), height: Math.max(1, Math.round((h * percent) / 100)) }
    }
    if (!keepAspect) return { width: targetWidth || w, height: targetHeight || h }
    const scale =
      targetWidth && targetHeight
        ? Math.min(targetWidth / w, targetHeight / h)
        : targetWidth
          ? targetWidth / w
          : targetHeight / h
    return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) }
  }

  const resize = () =>
    run(async (report) => {
      const out: OutputFile[] = []
      for (const [i, file] of files.entries()) {
        report(i / files.length, `Resizing ${file.name} (${i + 1}/${files.length})`)
        const type = encodableFormat(file)
        let size: Size | undefined
        const blob = await encodeImage(file, {
          type,
          quality: 0.92,
          resize: (w, h) => (size = targetSize(w, h)),
        })
        out.push({
          name: `${baseName(file.name)}-${size!.width}x${size!.height}.${FORMAT_EXT[type]}`,
          blob,
          note: `${size!.width} × ${size!.height} px`,
        })
      }
      setResults(out)
    })

  if (results) {
    return (
      <ResultList
        files={results}
        zipName="resized-images.zip"
        onReset={() => {
          setResults(null)
          setFiles([])
        }}
      />
    )
  }

  return (
    <div className="grid gap-6">
      <FilePicker files={files} onChange={setFiles} accept={IMAGE_ACCEPT} hint="JPG, PNG, WebP, HEIC, GIF, BMP" multiple disabled={busy} />
      <OptionsCard>
        <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)} className="sm:col-span-2">
          <TabsList>
            <TabsTrigger value="percent">By percentage</TabsTrigger>
            <TabsTrigger value="pixels">By pixels</TabsTrigger>
          </TabsList>
        </Tabs>
        {mode === "percent" ? (
          <Field label="Scale" value={`${percent}%`} className="grid gap-2 sm:col-span-2">
            <Slider min={5} max={200} step={5} value={[percent]} onValueChange={([v]) => setPercent(v)} />
          </Field>
        ) : (
          <>
            <Field label="Width (px)" htmlFor="width">
              <Input id="width" inputMode="numeric" placeholder="Auto" value={width} onChange={(e) => setWidth(e.target.value.replace(/\D/g, ""))} />
            </Field>
            <Field label="Height (px)" htmlFor="height">
              <Input id="height" inputMode="numeric" placeholder="Auto" value={height} onChange={(e) => setHeight(e.target.value.replace(/\D/g, ""))} />
            </Field>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Switch id="aspect" checked={keepAspect} onCheckedChange={setKeepAspect} />
              <Label htmlFor="aspect" className="font-normal">
                Keep aspect ratio (fit inside the width and height you set)
              </Label>
            </div>
          </>
        )}
      </OptionsCard>
      <div>
        <RunButton busy={busy} disabled={files.length === 0 || !valid} onClick={resize} icon={<Scaling />}>
          Resize {files.length > 1 ? `${files.length} images` : "image"}
        </RunButton>
      </div>
      <ProgressPanel progress={progress} />
    </div>
  )
}
