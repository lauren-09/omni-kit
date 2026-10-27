import { useState } from "react"
import { Combine } from "lucide-react"
import { FilePicker } from "@/components/file-picker"
import { ResultList } from "@/components/result-list"
import { ProgressPanel, RunButton } from "@/components/tool-parts"
import { useTask } from "@/hooks/use-task"
import { baseName, bytesToBlob, type OutputFile } from "@/lib/files"
import { loadPdfLib } from "@/lib/pdf"

export default function PdfMerge() {
  const [files, setFiles] = useState<File[]>([])
  const [results, setResults] = useState<OutputFile[] | null>(null)
  const { busy, progress, run } = useTask()

  const merge = () =>
    run(async (report) => {
      const { PDFDocument } = await import("pdf-lib")
      const merged = await PDFDocument.create()
      for (const [i, file] of files.entries()) {
        report(i / files.length, `Adding ${file.name}…`)
        const source = await loadPdfLib(file).catch((err: Error) => {
          throw new Error(`${file.name}: ${err.message}`)
        })
        const pages = await merged.copyPages(source, source.getPageIndices())
        pages.forEach((page) => merged.addPage(page))
      }
      report(1, "Saving…")
      const blob = bytesToBlob(await merged.save(), "application/pdf")
      setResults([{ name: `${baseName(files[0].name)}-merged.pdf`, blob, note: `${merged.getPageCount()} pages` }])
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
        accept=".pdf,application/pdf"
        hint="Add two or more PDFs, then put them in order"
        multiple
        reorderable
        disabled={busy}
      />
      <div>
        <RunButton busy={busy} disabled={files.length < 2} onClick={merge} icon={<Combine />}>
          Merge {files.length >= 2 ? `${files.length} PDFs` : "PDFs"}
        </RunButton>
      </div>
      <ProgressPanel progress={progress} />
    </div>
  )
}
