import { useState } from "react"
import { FileDown, TriangleAlert } from "lucide-react"
import { FilePicker } from "@/components/file-picker"
import { ResultList } from "@/components/result-list"
import { OptionsCard, ProgressPanel, RunButton } from "@/components/tool-parts"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useTask } from "@/hooks/use-task"
import { bytesToBlob, type OutputFile } from "@/lib/files"
import { canvasToBlob } from "@/lib/image"
import { openPdf, renderPage } from "@/lib/pdf"

const PRESETS = {
  strong: { label: "Strong", detail: "Smallest file. Good for on-screen reading.", dpi: 72, quality: 0.5 },
  balanced: { label: "Balanced", detail: "Recommended. Clear text, big savings.", dpi: 110, quality: 0.65 },
  light: { label: "Light", detail: "Near-original quality. Good for printing.", dpi: 150, quality: 0.8 },
} as const

type Preset = keyof typeof PRESETS

export default function PdfCompress() {
  const [files, setFiles] = useState<File[]>([])
  const [preset, setPreset] = useState<Preset>("balanced")
  const [results, setResults] = useState<OutputFile[] | null>(null)
  const { busy, progress, run } = useTask()

  const compress = () =>
    run(async (report) => {
      const { PDFDocument } = await import("pdf-lib")
      const { dpi, quality } = PRESETS[preset]
      const out: OutputFile[] = []
      for (const [f, file] of files.entries()) {
        const pdf = await openPdf(file)
        const doc = await PDFDocument.create()
        for (let n = 1; n <= pdf.numPages; n++) {
          report((f + (n - 1) / pdf.numPages) / files.length, `${file.name}: page ${n} of ${pdf.numPages}`)
          const page = await pdf.getPage(n)
          const { width, height } = page.getViewport({ scale: 1 })
          const canvas = await renderPage(page, dpi / 72)
          const jpg = await doc.embedJpg(new Uint8Array(await (await canvasToBlob(canvas, "image/jpeg", quality)).arrayBuffer()))
          doc.addPage([width, height]).drawImage(jpg, { x: 0, y: 0, width, height })
          page.cleanup()
        }
        const blob = bytesToBlob(await doc.save(), "application/pdf")
        out.push(
          blob.size < file.size
            ? { name: file.name.replace(/\.pdf$/i, "") + "-compressed.pdf", blob, originalSize: file.size }
            : { name: file.name, blob: file, originalSize: file.size, note: "Already well compressed, kept original" }
        )
      }
      setResults(out)
    })

  if (results) {
    return (
      <ResultList
        files={results}
        zipName="compressed-pdfs.zip"
        onReset={() => {
          setResults(null)
          setFiles([])
        }}
      />
    )
  }

  return (
    <div className="grid gap-6">
      <FilePicker files={files} onChange={setFiles} accept=".pdf,application/pdf" hint="PDF files" multiple disabled={busy} />
      <OptionsCard title="Compression level">
        <RadioGroup value={preset} onValueChange={(v) => setPreset(v as Preset)} className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
          {(Object.keys(PRESETS) as Preset[]).map((key) => (
            <Label
              key={key}
              htmlFor={key}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
            >
              <RadioGroupItem id={key} value={key} className="mt-0.5" />
              <span className="grid gap-1">
                <span className="font-medium">{PRESETS[key].label}</span>
                <span className="text-xs text-muted-foreground">{PRESETS[key].detail}</span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      </OptionsCard>
      <Alert>
        <TriangleAlert />
        <AlertDescription>
          Pages are re-saved as optimized images. This works best for scans and image-heavy PDFs. Text in the result can't be selected or
          searched.
        </AlertDescription>
      </Alert>
      <div>
        <RunButton busy={busy} disabled={files.length === 0} onClick={compress} icon={<FileDown />}>
          Compress PDF
        </RunButton>
      </div>
      <ProgressPanel progress={progress} />
    </div>
  )
}
