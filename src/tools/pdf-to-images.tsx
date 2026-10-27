import { useState } from "react"
import { FileImage } from "lucide-react"
import { FilePicker } from "@/components/file-picker"
import { ResultList } from "@/components/result-list"
import { Field, OptionsCard, ProgressPanel, RunButton } from "@/components/tool-parts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTask } from "@/hooks/use-task"
import { baseName, type OutputFile } from "@/lib/files"
import { pdfToImages } from "@/lib/pdf"

type Format = "image/png" | "image/jpeg"

export default function PdfToImages({ defaultFormat = "image/png" }: { defaultFormat?: Format }) {
  const [files, setFiles] = useState<File[]>([])
  const [format, setFormat] = useState<Format>(defaultFormat)
  const [dpi, setDpi] = useState("150")
  const [results, setResults] = useState<OutputFile[] | null>(null)
  const { busy, progress, run } = useTask()

  const convert = () =>
    run(async (report) => {
      const out: OutputFile[] = []
      for (const [i, file] of files.entries()) {
        out.push(...(await pdfToImages(file, format, Number(dpi), (f, label) => report((i + f) / files.length, label))))
      }
      setResults(out)
    })

  if (results) {
    return (
      <ResultList
        files={results}
        zipName={files.length === 1 ? `${baseName(files[0].name)}-images.zip` : "pdf-images.zip"}
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
        <Field label="Image format">
          <Tabs value={format} onValueChange={(v) => setFormat(v as Format)}>
            <TabsList>
              <TabsTrigger value="image/png">PNG</TabsTrigger>
              <TabsTrigger value="image/jpeg">JPG</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Field label="Resolution" htmlFor="dpi">
          <Select value={dpi} onValueChange={setDpi}>
            <SelectTrigger id="dpi" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="72">72 DPI (screen)</SelectItem>
              <SelectItem value="150">150 DPI (standard)</SelectItem>
              <SelectItem value="300">300 DPI (print)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </OptionsCard>
      <div>
        <RunButton busy={busy} disabled={files.length === 0} onClick={convert} icon={<FileImage />}>
          Convert to images
        </RunButton>
      </div>
      <ProgressPanel progress={progress} />
    </div>
  )
}
