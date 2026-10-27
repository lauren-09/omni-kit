import { useState } from "react"
import { FileText, Info, Printer } from "lucide-react"
import { FilePicker } from "@/components/file-picker"
import { ResultList } from "@/components/result-list"
import { ProgressPanel, RunButton } from "@/components/tool-parts"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useTask } from "@/hooks/use-task"
import { docxToPdf, printDocx } from "@/lib/documents/docx-render"
import { withExt, type OutputFile } from "@/lib/files"

export default function WordToPdf() {
  const [files, setFiles] = useState<File[]>([])
  const [results, setResults] = useState<OutputFile[] | null>(null)
  const { busy, progress, run } = useTask()

  const convert = () =>
    run(async (report) => {
      const file = files[0]
      const blob = await docxToPdf(file, report)
      setResults([{ name: withExt(file.name, "pdf"), blob }])
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
      <FilePicker files={files} onChange={setFiles} accept=".docx" hint="Microsoft Word .docx" disabled={busy} />
      <Alert>
        <Info />
        <AlertDescription>
          <p>
            <strong className="text-foreground">Convert to PDF</strong> gives a one-click PDF that looks exactly like the preview. Each page is
            stored as an image.
          </p>
          <p>
            <strong className="text-foreground">Print to PDF</strong> keeps text selectable and searchable. Choose "Save as PDF" in the print
            dialog.
          </p>
        </AlertDescription>
      </Alert>
      <div className="flex flex-col gap-3 sm:flex-row">
        <RunButton busy={busy} disabled={files.length === 0} onClick={convert} icon={<FileText />}>
          Convert to PDF
        </RunButton>
        <Button
          variant="outline"
          size="lg"
          className="h-11 text-base sm:px-6"
          disabled={busy || files.length === 0}
          onClick={() => run(() => printDocx(files[0]))}
        >
          <Printer /> Print to PDF (selectable text)
        </Button>
      </div>
      <ProgressPanel progress={progress} />
    </div>
  )
}
