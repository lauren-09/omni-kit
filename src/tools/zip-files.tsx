import { useState } from "react"
import { FileArchive } from "lucide-react"
import { FilePicker } from "@/components/file-picker"
import { ResultList } from "@/components/result-list"
import { Field, OptionsCard, ProgressPanel, RunButton } from "@/components/tool-parts"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTask } from "@/hooks/use-task"
import { zipFiles, type OutputFile, type ZipLevel } from "@/lib/files"

export default function ZipFiles() {
  const [files, setFiles] = useState<File[]>([])
  const [name, setName] = useState("archive")
  const [level, setLevel] = useState("9")
  const [results, setResults] = useState<OutputFile[] | null>(null)
  const { busy, progress, run } = useTask()

  const create = () =>
    run(async (report) => {
      report(0.1, `Compressing ${files.length} files…`)
      const blob = await zipFiles(
        // Folder uploads keep their structure inside the archive.
        files.map((file) => ({ name: file.webkitRelativePath || file.name, blob: file })),
        Number(level) as ZipLevel
      )
      const originalSize = files.reduce((sum, file) => sum + file.size, 0)
      setResults([{ name: `${name.trim() || "archive"}.zip`, blob, originalSize, note: `${files.length} files` }])
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
      <FilePicker files={files} onChange={setFiles} accept="" hint="Any file type · or pick a whole folder" multiple allowFolders disabled={busy} />
      <OptionsCard>
        <Field label="Archive name" htmlFor="zip-name">
          <div className="flex items-center gap-2">
            <Input id="zip-name" value={name} onChange={(e) => setName(e.target.value.replace(/[\\/:*?"<>|]/g, ""))} />
            <span className="text-sm text-muted-foreground">.zip</span>
          </div>
        </Field>
        <Field
          label="Compression"
          htmlFor="level"
          hint="Photos, videos and PDFs are already compressed and won't shrink much. Text and documents shrink a lot."
        >
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger id="level" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="9">Maximum (smallest)</SelectItem>
              <SelectItem value="6">Normal</SelectItem>
              <SelectItem value="1">Fast</SelectItem>
              <SelectItem value="0">None (store only)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </OptionsCard>
      <div>
        <RunButton busy={busy} disabled={files.length === 0} onClick={create} icon={<FileArchive />}>
          Create ZIP
        </RunButton>
      </div>
      <ProgressPanel progress={progress} />
    </div>
  )
}
