import { useState } from "react"
import { PenTool } from "lucide-react"
import { FilePicker } from "@/components/file-picker"
import { ResultList } from "@/components/result-list"
import { Field, OptionsCard, ProgressPanel, RunButton } from "@/components/tool-parts"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTask } from "@/hooks/use-task"
import { withExt, type OutputFile } from "@/lib/files"
import { decodeImage, fitWithin, IMAGE_ACCEPT } from "@/lib/image"

const STYLES = {
  logo: { label: "Logo / icon", hint: "Flat colours and clean shapes.", maxSide: 800, colors: 8, options: { ltres: 1, qtres: 1, pathomit: 8, blurradius: 0 } },
  art: { label: "Illustration", hint: "More colours, finer detail.", maxSide: 1000, colors: 24, options: { ltres: 0.5, qtres: 0.5, pathomit: 4, blurradius: 0 } },
  photo: { label: "Photo", hint: "Painterly look. Large file, slow to trace.", maxSide: 700, colors: 48, options: { ltres: 0.2, qtres: 0.2, pathomit: 2, blurradius: 1 } },
} as const

type Style = keyof typeof STYLES

function trace(imageData: ImageData, options: Record<string, number>): Promise<string> {
  const worker = new Worker(new URL("../workers/trace.worker.ts", import.meta.url), { type: "module" })
  return new Promise<string>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<{ svg?: string; error?: string }>) =>
      e.data.svg ? resolve(e.data.svg) : reject(new Error(e.data.error ?? "Tracing failed."))
    worker.onerror = () => reject(new Error("Tracing failed."))
    worker.postMessage({ imageData, options }, [imageData.data.buffer])
  }).finally(() => worker.terminate())
}

export default function ImageTrace() {
  const [files, setFiles] = useState<File[]>([])
  const [style, setStyle] = useState<Style>("logo")
  const [colors, setColors] = useState<number>(STYLES.logo.colors)
  const [results, setResults] = useState<OutputFile[] | null>(null)
  const { busy, progress, run } = useTask()

  const vectorize = () =>
    run(async (report) => {
      const preset = STYLES[style]
      const out: OutputFile[] = []
      for (const [i, file] of files.entries()) {
        report(i / files.length, `Tracing ${file.name} (${i + 1}/${files.length})…`)
        const image = await decodeImage(file)
        // Tracing time grows with pixel count, so work on a reasonably sized copy.
        const { width, height } = fitWithin(image.width, image.height, preset.maxSide, preset.maxSide)
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!
        ctx.drawImage(image.source, 0, 0, width, height)
        image.close()
        const svg = await trace(ctx.getImageData(0, 0, width, height), {
          ...preset.options,
          numberofcolors: colors,
          colorquantcycles: 3,
          roundcoords: 1,
          viewbox: 1,
        })
        out.push({ name: withExt(file.name, "svg"), blob: new Blob([svg], { type: "image/svg+xml" }), originalSize: file.size })
      }
      setResults(out)
    })

  if (results) {
    return (
      <ResultList
        files={results}
        zipName="vectorized.zip"
        checkerboard
        onReset={() => {
          setResults(null)
          setFiles([])
        }}
      />
    )
  }

  return (
    <div className="grid gap-6">
      <FilePicker files={files} onChange={setFiles} accept={IMAGE_ACCEPT} hint="PNG, JPG, WebP · logos and icons work best" multiple disabled={busy} />
      <OptionsCard>
        <Field label="Image type" hint={STYLES[style].hint}>
          <Tabs
            value={style}
            onValueChange={(v) => {
              setStyle(v as Style)
              setColors(STYLES[v as Style].colors)
            }}
          >
            <TabsList>
              {(Object.keys(STYLES) as Style[]).map((key) => (
                <TabsTrigger key={key} value={key}>
                  {STYLES[key].label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </Field>
        <Field label="Colours" value={colors} hint="Fewer colours give simpler, smaller SVGs.">
          <Slider min={2} max={64} step={1} value={[colors]} onValueChange={([v]) => setColors(v)} />
        </Field>
      </OptionsCard>
      <div>
        <RunButton busy={busy} disabled={files.length === 0} onClick={vectorize} icon={<PenTool />}>
          Convert to SVG
        </RunButton>
      </div>
      <ProgressPanel progress={progress} />
    </div>
  )
}
