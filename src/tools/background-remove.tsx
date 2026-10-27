import { useMemo, useState } from "react"
import { Info, WandSparkles } from "lucide-react"
import { FilePicker } from "@/components/file-picker"
import { ResultList } from "@/components/result-list"
import { Field, OptionsCard, ProgressPanel, RunButton } from "@/components/tool-parts"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useObjectUrls } from "@/hooks/use-object-urls"
import { useTask } from "@/hooks/use-task"
import { baseName, type OutputFile } from "@/lib/files"
import { encodeImage } from "@/lib/image"

type Model = "isnet_quint8" | "isnet_fp16"

export default function BackgroundRemove() {
  const [files, setFiles] = useState<File[]>([])
  const [model, setModel] = useState<Model>("isnet_fp16")
  const [fill, setFill] = useState<"transparent" | "color">("transparent")
  const [color, setColor] = useState("#ffffff")
  const [results, setResults] = useState<OutputFile[] | null>(null)
  const { busy, progress, run } = useTask()

  const preview = useMemo(() => [files[0], results?.[0]?.blob], [files, results])
  const [beforeUrl, afterUrl] = useObjectUrls(preview)

  const remove = () =>
    run(async (report) => {
      report(0, "Loading AI engine…")
      const { removeBackground } = await import("@imgly/background-removal")
      const out: OutputFile[] = []
      for (const [i, file] of files.entries()) {
        const cutout = await removeBackground(file, {
          model,
          output: { format: "image/png" },
          progress: (key, current, total) => {
            if (key.startsWith("fetch")) {
              report(current / total, "Downloading AI model (one time only, then cached)…")
            } else {
              report((i + current / total) / files.length, `Removing background from ${file.name} (${i + 1}/${files.length})`)
            }
          },
        })
        const blob =
          fill === "color" ? await encodeImage(cutout, { type: "image/jpeg", quality: 0.92, background: color }) : cutout
        out.push({ name: `${baseName(file.name)}-no-bg.${fill === "color" ? "jpg" : "png"}`, blob })
      }
      setResults(out)
    })

  if (results) {
    return (
      <div className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { label: "Original", url: beforeUrl, checker: false },
            { label: "Result", url: afterUrl, checker: true },
          ].map(({ label, url, checker }) => (
            <figure key={label} className="grid gap-2">
              <div className={`flex aspect-square items-center justify-center overflow-hidden rounded-xl border ${checker ? "bg-checkerboard" : "bg-muted"}`}>
                {url && <img src={url} alt={label} className="max-h-full max-w-full object-contain" />}
              </div>
              <figcaption className="text-center text-sm text-muted-foreground">{label}</figcaption>
            </figure>
          ))}
        </div>
        <ResultList
          files={results}
          zipName="background-removed.zip"
          checkerboard
          onReset={() => {
            setResults(null)
            setFiles([])
          }}
        />
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      <FilePicker files={files} onChange={setFiles} accept="image/png,image/jpeg,image/webp" hint="JPG, PNG, WebP · people, products, pets, objects" multiple disabled={busy} />
      <OptionsCard>
        <Field label="Quality" hint={model === "isnet_fp16" ? "Best edges. ~80 MB model download the first time." : "Quicker. ~40 MB model download the first time."}>
          <Tabs value={model} onValueChange={(v) => setModel(v as Model)}>
            <TabsList>
              <TabsTrigger value="isnet_fp16">Best</TabsTrigger>
              <TabsTrigger value="isnet_quint8">Fast</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Field label="New background">
          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={fill} onValueChange={(v) => setFill(v as typeof fill)}>
              <TabsList>
                <TabsTrigger value="transparent">Transparent</TabsTrigger>
                <TabsTrigger value="color">Solid colour</TabsTrigger>
              </TabsList>
            </Tabs>
            {fill === "color" && (
              <Input
                type="color"
                aria-label="Background colour"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 w-12 cursor-pointer p-1"
              />
            )}
          </div>
        </Field>
      </OptionsCard>
      <Alert>
        <Info />
        <AlertDescription>
          The AI model runs on your own device. Your photos are never uploaded. The first run downloads the model, and later runs start instantly.
        </AlertDescription>
      </Alert>
      <div>
        <RunButton busy={busy} disabled={files.length === 0} onClick={remove} icon={<WandSparkles />}>
          Remove background
        </RunButton>
      </div>
      <ProgressPanel progress={progress} />
    </div>
  )
}
