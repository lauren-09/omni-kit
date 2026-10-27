import { useState } from "react"
import { FileType } from "lucide-react"
import { FilePicker } from "@/components/file-picker"
import { ResultList } from "@/components/result-list"
import { Field, OptionsCard, ProgressPanel, RunButton } from "@/components/tool-parts"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTask, type Report } from "@/hooks/use-task"
import { readPdf } from "@/lib/documents/read-pdf"
import { writeDocx } from "@/lib/documents/write"
import { baseName, withExt, type OutputFile } from "@/lib/files"
import { canvasToBlob } from "@/lib/image"
import { openPdf, renderPage } from "@/lib/pdf"

type Mode = "editable" | "layout"

/** Places each page as a full-page picture: identical look, works for scans, not editable. */
async function pdfToLayoutDocx(file: File, report: Report): Promise<Blob> {
  const { Document, ImageRun, Packer, Paragraph } = await import("docx")
  const pdf = await openPdf(file)
  const sections = []
  for (let n = 1; n <= pdf.numPages; n++) {
    report((n - 1) / pdf.numPages, `Rendering page ${n} of ${pdf.numPages}…`)
    const page = await pdf.getPage(n)
    const { width, height } = page.getViewport({ scale: 1 })
    const canvas = await renderPage(page, 2)
    const data = new Uint8Array(await (await canvasToBlob(canvas, "image/jpeg", 0.85)).arrayBuffer())
    page.cleanup()
    sections.push({
      properties: {
        page: {
          size: { width: Math.round(width * 20), height: Math.round(height * 20) },
          margin: { top: 0, right: 0, bottom: 0, left: 0, header: 0, footer: 0 },
        },
      },
      children: [
        new Paragraph({
          spacing: { before: 0, after: 0 },
          // Points to 96-dpi pixels, trimmed slightly so Word never spills onto a blank page.
          children: [new ImageRun({ type: "jpg", data, transformation: { width: (width * 4) / 3 - 1, height: (height * 4) / 3 - 4 } })],
        }),
      ],
    })
  }
  return Packer.toBlob(new Document({ sections }))
}

export default function PdfToWord() {
  const [files, setFiles] = useState<File[]>([])
  const [mode, setMode] = useState<Mode>("editable")
  const [results, setResults] = useState<OutputFile[] | null>(null)
  const { busy, progress, run } = useTask()

  const convert = () =>
    run(async (report) => {
      const out: OutputFile[] = []
      for (const [i, file] of files.entries()) {
        const scoped: Report = (f, label) => report((i + f) / files.length, label)
        const blob =
          mode === "editable"
            ? await writeDocx(await readPdf(file, baseName(file.name), scoped).catch((err: Error) => {
                throw new Error(err.message.replace("there's no text to convert.", 'try "Exact layout" mode instead.'))
              }))
            : await pdfToLayoutDocx(file, scoped)
        out.push({ name: withExt(file.name, "docx"), blob })
      }
      setResults(out)
    })

  if (results) {
    return (
      <ResultList
        files={results}
        zipName="word-documents.zip"
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
      <OptionsCard>
        <Field
          label="Conversion mode"
          className="grid gap-2 sm:col-span-2"
          hint={
            mode === "editable"
              ? "Extracts text, headings and paragraphs you can edit. Complex layouts such as columns and tables come out as plain text."
              : "Each page is placed as a picture, so the result looks identical but the text can't be edited. Works for scanned PDFs."
          }
        >
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="editable">Editable text</TabsTrigger>
              <TabsTrigger value="layout">Exact layout</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      </OptionsCard>
      <div>
        <RunButton busy={busy} disabled={files.length === 0} onClick={convert} icon={<FileType />}>
          Convert to Word
        </RunButton>
      </div>
      <ProgressPanel progress={progress} />
    </div>
  )
}
