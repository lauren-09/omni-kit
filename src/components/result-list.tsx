import { useMemo, useState } from "react"
import { CircleCheck, Download, FileArchive, File as FileIcon, RotateCcw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useObjectUrls } from "@/hooks/use-object-urls"
import { downloadBlob, formatBytes, zipFiles, type OutputFile } from "@/lib/files"
import { cn } from "@/lib/utils"

type ResultListProps = {
  files: OutputFile[]
  /** Name of the archive offered when there is more than one file. `null` hides "Download all". */
  zipName?: string | null
  /** Draw image previews on a checkerboard so transparency is visible. */
  checkerboard?: boolean
  onReset?: () => void
}

function Savings({ before, after }: { before: number; after: number }) {
  const change = Math.round((1 - after / before) * 100)
  if (change > 0) {
    return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">−{change}%</Badge>
  }
  return <Badge variant="outline">{change === 0 ? "same size" : `+${-change}%`}</Badge>
}

export function ResultList({ files, zipName = "omnikit-files.zip", checkerboard, onReset }: ResultListProps) {
  const imageBlobs = useMemo(() => files.map((f) => (f.blob.type.startsWith("image/") ? f.blob : null)), [files])
  const previews = useObjectUrls(imageBlobs)
  const [zipping, setZipping] = useState(false)
  const totalBefore = files.reduce((sum, f) => sum + (f.originalSize ?? 0), 0)
  const totalAfter = files.reduce((sum, f) => sum + f.blob.size, 0)

  async function downloadAll() {
    setZipping(true)
    try {
      downloadBlob(await zipFiles(files, 0), zipName!)
    } finally {
      setZipping(false)
    }
  }

  return (
    <Card className="animate-in fade-in-0 slide-in-from-bottom-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CircleCheck className="size-5 text-emerald-600 dark:text-emerald-400" />
          {files.length === 1 ? "Your file is ready" : `${files.length} files ready`}
        </CardTitle>
        <CardDescription>
          {totalBefore > 0
            ? `${formatBytes(totalBefore)} → ${formatBytes(totalAfter)}`
            : `Total ${formatBytes(totalAfter)}`}
        </CardDescription>
        <CardAction className="flex gap-2">
          {onReset && (
            <Button variant="ghost" size="sm" onClick={onReset}>
              <RotateCcw /> Start over
            </Button>
          )}
          {files.length > 1 && zipName !== null && (
            <Button size="sm" onClick={downloadAll} disabled={zipping}>
              <FileArchive /> {zipping ? "Zipping…" : "Download all"}
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="max-h-112 divide-y overflow-y-auto rounded-lg border">
          {files.map((file, i) => (
            <li key={`${i}-${file.name}`} className="flex items-center gap-3 p-2.5">
              <div
                className={cn(
                  "flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted",
                  checkerboard && previews[i] && "bg-checkerboard"
                )}
              >
                {previews[i] ? (
                  <img src={previews[i]!} alt="" className="size-full object-contain" />
                ) : (
                  <FileIcon className="size-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={file.name}>
                  {file.name}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {file.originalSize ? `${formatBytes(file.originalSize)} → ` : ""}
                    {formatBytes(file.blob.size)}
                  </span>
                  {file.originalSize ? <Savings before={file.originalSize} after={file.blob.size} /> : null}
                  {file.note && <span>{file.note}</span>}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => downloadBlob(file.blob, file.name)}>
                <Download /> <span className="hidden sm:inline">Download</span>
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
