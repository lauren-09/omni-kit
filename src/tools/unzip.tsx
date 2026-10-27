import { useState } from "react"
import { PackageOpen } from "lucide-react"
import { FilePicker } from "@/components/file-picker"
import { ResultList } from "@/components/result-list"
import { ProgressPanel, RunButton } from "@/components/tool-parts"
import { useTask } from "@/hooks/use-task"
import { bytesToBlob, type OutputFile } from "@/lib/files"

// Only needed so extracted images get a preview thumbnail.
const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
}

export default function Unzip() {
  const [files, setFiles] = useState<File[]>([])
  const [results, setResults] = useState<OutputFile[] | null>(null)
  const { busy, progress, run } = useTask()

  const extract = () =>
    run(async (report) => {
      report(0.1, "Extracting…")
      const { unzip } = await import("fflate")
      const data = new Uint8Array(await files[0].arrayBuffer())
      const entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) =>
        unzip(data, (err, out) =>
          err ? reject(new Error("Couldn't open this archive. It may be password-protected or damaged.")) : resolve(out)
        )
      )
      const out = Object.entries(entries)
        .filter(([path]) => !path.endsWith("/") && !path.startsWith("__MACOSX/"))
        .map(([path, bytes]) => {
          const ext = path.split(".").pop()?.toLowerCase() ?? ""
          return { name: path, blob: bytesToBlob(bytes, IMAGE_TYPES[ext] ?? "application/octet-stream") }
        })
      if (out.length === 0) throw new Error("This archive is empty.")
      setResults(out)
    })

  if (results) {
    return (
      <ResultList
        files={results}
        zipName={null}
        onReset={() => {
          setResults(null)
          setFiles([])
        }}
      />
    )
  }

  return (
    <div className="grid gap-6">
      <FilePicker files={files} onChange={setFiles} accept=".zip,application/zip" hint="ZIP archives" disabled={busy} />
      <div>
        <RunButton busy={busy} disabled={files.length === 0} onClick={extract} icon={<PackageOpen />}>
          Extract files
        </RunButton>
      </div>
      <ProgressPanel progress={progress} />
    </div>
  )
}
