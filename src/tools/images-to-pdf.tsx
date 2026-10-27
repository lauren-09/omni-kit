import { useState } from "react"
import { Images } from "lucide-react"
import { FilePicker } from "@/components/file-picker"
import { ResultList } from "@/components/result-list"
import { Field, OptionsCard, ProgressPanel, RunButton } from "@/components/tool-parts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTask } from "@/hooks/use-task"
import { baseName, bytesToBlob, type OutputFile } from "@/lib/files"
import { encodeImage, IMAGE_ACCEPT } from "@/lib/image"

const PAGE_SIZES = { a4: [595.28, 841.89], letter: [612, 792] } as const
const MARGINS = { none: 0, small: 18, large: 36 } as const

type PageSize = "fit" | keyof typeof PAGE_SIZES
type Orientation = "auto" | "portrait" | "landscape"
type Margin = keyof typeof MARGINS

export default function ImagesToPdf({
  accept = IMAGE_ACCEPT,
  hint = "JPG, PNG, HEIC, WebP, GIF · one page per image, in the order shown",
}: {
  accept?: string
  hint?: string
}) {
  const [files, setFiles] = useState<File[]>([])
  const [pageSize, setPageSize] = useState<PageSize>("a4")
  const [orientation, setOrientation] = useState<Orientation>("auto")
  const [margin, setMargin] = useState<Margin>("small")
  const [results, setResults] = useState<OutputFile[] | null>(null)
  const { busy, progress, run } = useTask()

  const create = () =>
    run(async (report) => {
      const { PDFDocument } = await import("pdf-lib")
      const doc = await PDFDocument.create()
      const m = MARGINS[margin]
      for (const [i, file] of files.entries()) {
        report(i / files.length, `Adding ${file.name}…`)
        // Re-encoding normalizes EXIF rotation and turns WebP/GIF/BMP into formats PDFs support.
        const png = file.type === "image/png"
        const blob = await encodeImage(file, { type: png ? "image/png" : "image/jpeg", quality: 0.92 })
        const bytes = new Uint8Array(await blob.arrayBuffer())
        const image = png ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)

        let pageWidth: number
        let pageHeight: number
        if (pageSize === "fit") {
          // 96-dpi pixels to points.
          pageWidth = image.width * 0.75 + 2 * m
          pageHeight = image.height * 0.75 + 2 * m
        } else {
          const [w, h] = PAGE_SIZES[pageSize]
          const landscape = orientation === "auto" ? image.width > image.height : orientation === "landscape"
          ;[pageWidth, pageHeight] = landscape ? [h, w] : [w, h]
        }
        const scale = Math.min((pageWidth - 2 * m) / image.width, (pageHeight - 2 * m) / image.height)
        const width = image.width * scale
        const height = image.height * scale
        doc.addPage([pageWidth, pageHeight]).drawImage(image, {
          x: (pageWidth - width) / 2,
          y: (pageHeight - height) / 2,
          width,
          height,
        })
      }
      report(1, "Saving…")
      const name = files.length === 1 ? `${baseName(files[0].name)}.pdf` : "images.pdf"
      setResults([{ name, blob: bytesToBlob(await doc.save(), "application/pdf"), note: `${files.length} pages` }])
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
        accept={accept}
        hint={hint}
        multiple
        reorderable
        disabled={busy}
      />
      <OptionsCard>
        <Field label="Page size" htmlFor="size">
          <Select value={pageSize} onValueChange={(v) => setPageSize(v as PageSize)}>
            <SelectTrigger id="size" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a4">A4</SelectItem>
              <SelectItem value="letter">US Letter</SelectItem>
              <SelectItem value="fit">Same as image</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Orientation" htmlFor="orientation">
          <Select value={orientation} onValueChange={(v) => setOrientation(v as Orientation)} disabled={pageSize === "fit"}>
            <SelectTrigger id="orientation" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Automatic (match each image)</SelectItem>
              <SelectItem value="portrait">Portrait</SelectItem>
              <SelectItem value="landscape">Landscape</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Margin" htmlFor="margin">
          <Select value={margin} onValueChange={(v) => setMargin(v as Margin)}>
            <SelectTrigger id="margin" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="small">Small</SelectItem>
              <SelectItem value="large">Large</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </OptionsCard>
      <div>
        <RunButton busy={busy} disabled={files.length === 0} onClick={create} icon={<Images />}>
          Create PDF
        </RunButton>
      </div>
      <ProgressPanel progress={progress} />
    </div>
  )
}
