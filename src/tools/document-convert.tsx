import { useState } from "react"
import { FileOutput, Info } from "lucide-react"
import { toast } from "sonner"
import { FilePicker } from "@/components/file-picker"
import { ResultList } from "@/components/result-list"
import { OptionsCard, ProgressPanel, RunButton } from "@/components/tool-parts"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useTask } from "@/hooks/use-task"
import { acceptFor, convertDocument, detectFormat, OUTPUTS, outputsFor, type DocFormat, type DocOutput } from "@/lib/documents/convert"
import type { OutputFile } from "@/lib/files"

type DocumentConvertProps = {
  inputs: DocFormat[]
  outputs: DocOutput[]
  defaultOutput: DocOutput
  hint: string
}

export default function DocumentConvert({ inputs, outputs, defaultOutput, hint }: DocumentConvertProps) {
  const [files, setFiles] = useState<File[]>([])
  const [chosen, setChosen] = useState<DocOutput>(defaultOutput)
  const [results, setResults] = useState<OutputFile[] | null>(null)
  const { busy, progress, run } = useTask()

  const formats = files.map(detectFormat).filter((f): f is DocFormat => f !== null)
  // Only offer outputs that at least one selected file can be converted to.
  const available = formats.length ? outputs.filter((o) => formats.some((f) => outputsFor(f, outputs).includes(o))) : outputs
  const output = available.includes(chosen) ? chosen : available[0]
  const keepsLayout = output === "pdf" && formats.length > 0 && formats.every((f) => f === "docx")

  const convert = () =>
    run(async (report) => {
      const out: OutputFile[] = []
      for (const [i, file] of files.entries()) {
        const format = detectFormat(file)
        if (!format || !outputsFor(format, outputs).includes(output)) {
          toast.warning(`Skipped ${file.name}: it's already ${OUTPUTS[output].label}.`)
          continue
        }
        out.push(...(await convertDocument(file, output, (f, label) => report((i + f) / files.length, label))))
      }
      if (out.length) setResults(out)
    })

  if (results) {
    return (
      <ResultList
        files={results}
        zipName={`converted-${output}.zip`}
        onReset={() => {
          setResults(null)
          setFiles([])
        }}
      />
    )
  }

  return (
    <div className="grid gap-6">
      <FilePicker files={files} onChange={setFiles} accept={acceptFor(inputs)} hint={hint} multiple disabled={busy} />
      <OptionsCard title="Convert to">
        <RadioGroup value={output} onValueChange={(v) => setChosen(v as DocOutput)} className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
          {available.map((key) => (
            <Label
              key={key}
              htmlFor={`out-${key}`}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
            >
              <RadioGroupItem id={`out-${key}`} value={key} className="mt-0.5" />
              <span className="grid gap-1">
                <span className="font-medium">{OUTPUTS[key].label}</span>
                <span className="text-xs text-muted-foreground">{OUTPUTS[key].detail}</span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      </OptionsCard>
      {output !== "jpg" && output !== "png" && (
        <Alert>
          <Info />
          <AlertDescription>
            {keepsLayout
              ? "Word to PDF keeps the original page layout."
              : "Text, headings, bold and italic, lists and images are converted. Tables and multi-column layouts are simplified, and scanned PDFs have no text to extract."}
          </AlertDescription>
        </Alert>
      )}
      <div>
        <RunButton busy={busy} disabled={files.length === 0} onClick={convert} icon={<FileOutput />}>
          Convert to {OUTPUTS[output].label}
        </RunButton>
      </div>
      <ProgressPanel progress={progress} />
    </div>
  )
}
