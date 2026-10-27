import { useEffect, useState } from "react"
import { Scissors } from "lucide-react"
import type { PDFDocument } from "pdf-lib"
import { toast } from "sonner"
import { FilePicker } from "@/components/file-picker"
import { ResultList } from "@/components/result-list"
import { Field, OptionsCard, ProgressPanel, RunButton } from "@/components/tool-parts"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTask } from "@/hooks/use-task"
import { baseName, bytesToBlob, type OutputFile } from "@/lib/files"
import { loadPdfLib } from "@/lib/pdf"

type Mode = "extract" | "ranges" | "every"
type Range = [start: number, end: number]

/** Parses "1-3, 5, 8-" (1-based, "8-" means to the end) into ranges. */
function parseRanges(input: string, pageCount: number): Range[] {
  const ranges = input
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part): Range => {
      const match = part.match(/^(\d+)\s*(-\s*(\d+)?)?$/)
      if (!match) throw new Error(`"${part}" isn't a valid page or range.`)
      const start = Number(match[1])
      const end = match[3] ? Number(match[3]) : match[2] ? pageCount : start
      if (start < 1 || end > pageCount || start > end) throw new Error(`"${part}" is outside pages 1–${pageCount}.`)
      return [start, end]
    })
  if (ranges.length === 0) throw new Error("Enter at least one page number.")
  return ranges
}

const pagesIn = ([start, end]: Range) => Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i)

async function buildPdf(source: PDFDocument, indices: number[]): Promise<Blob> {
  const { PDFDocument } = await import("pdf-lib")
  const doc = await PDFDocument.create()
  ;(await doc.copyPages(source, indices)).forEach((page) => doc.addPage(page))
  return bytesToBlob(await doc.save(), "application/pdf")
}

export default function PdfSplit() {
  const [files, setFiles] = useState<File[]>([])
  const [pageCount, setPageCount] = useState<number | null>(null)
  const [mode, setMode] = useState<Mode>("extract")
  const [input, setInput] = useState("")
  const [results, setResults] = useState<OutputFile[] | null>(null)
  const { busy, progress, run } = useTask()
  const file = files[0]

  useEffect(() => {
    setPageCount(null)
    if (!file) return
    let cancelled = false
    loadPdfLib(file)
      .then((doc) => !cancelled && setPageCount(doc.getPageCount()))
      .catch((err: Error) => {
        toast.error(err.message)
        setFiles([])
      })
    return () => {
      cancelled = true
    }
  }, [file])

  const split = () =>
    run(async (report) => {
      const source = await loadPdfLib(file)
      const count = source.getPageCount()
      const name = baseName(file.name)
      const out: OutputFile[] = []

      if (mode === "extract") {
        const indices = parseRanges(input, count).flatMap(pagesIn)
        out.push({ name: `${name}-extract.pdf`, blob: await buildPdf(source, indices), note: `${indices.length} pages` })
      } else {
        const ranges: Range[] = mode === "every" ? pagesIn([1, count]).map((i) => [i + 1, i + 1]) : parseRanges(input, count)
        for (const [i, range] of ranges.entries()) {
          report(i / ranges.length, `Creating file ${i + 1} of ${ranges.length}…`)
          const label = range[0] === range[1] ? `page-${range[0]}` : `pages-${range[0]}-${range[1]}`
          out.push({ name: `${name}-${label}.pdf`, blob: await buildPdf(source, pagesIn(range)) })
        }
      }
      setResults(out)
    })

  if (results) {
    return (
      <ResultList
        files={results}
        zipName={`${baseName(file.name)}-split.zip`}
        onReset={() => {
          setResults(null)
          setFiles([])
          setInput("")
        }}
      />
    )
  }

  return (
    <div className="grid gap-6">
      <FilePicker files={files} onChange={setFiles} accept=".pdf,application/pdf" hint="One PDF file" disabled={busy} />
      {file && (
        <OptionsCard>
          <Field label="How to split" className="grid gap-2 sm:col-span-2">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="extract">Extract pages</TabsTrigger>
                <TabsTrigger value="ranges">Split by ranges</TabsTrigger>
                <TabsTrigger value="every">Every page</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {mode === "every" ? (
            <p className="text-sm text-muted-foreground sm:col-span-2">
              Creates {pageCount ?? "…"} single-page PDFs.
            </p>
          ) : (
            <Field
              label="Pages"
              htmlFor="pages"
              className="grid gap-2 sm:col-span-2"
              value={pageCount ? `${pageCount} pages in file` : "Counting pages…"}
              hint={
                mode === "extract"
                  ? 'All listed pages go into one new PDF. Example: "1-3, 5, 9-"'
                  : 'Each range becomes its own PDF. Example: "1-4, 5-8, 9-"'
              }
            >
              <Input id="pages" placeholder="e.g. 1-3, 5, 9-" value={input} onChange={(e) => setInput(e.target.value)} />
            </Field>
          )}
        </OptionsCard>
      )}
      <div>
        <RunButton
          busy={busy}
          disabled={!pageCount || (mode !== "every" && input.trim() === "")}
          onClick={split}
          icon={<Scissors />}
        >
          Split PDF
        </RunButton>
      </div>
      <ProgressPanel progress={progress} />
    </div>
  )
}
