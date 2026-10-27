import { ArrowDown, ArrowUp, File as FileIcon, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatBytes } from "@/lib/files"

type FileListProps = {
  files: File[]
  onChange: (files: File[]) => void
  /** Show order numbers and move buttons (for merging). */
  reorderable?: boolean
  disabled?: boolean
}

export function FileList({ files, onChange, reorderable, disabled }: FileListProps) {
  const total = files.reduce((sum, file) => sum + file.size, 0)

  function move(from: number, to: number) {
    const next = [...files]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  return (
    <div className="rounded-xl border bg-card">
      <ul className="max-h-80 divide-y overflow-y-auto">
        {files.map((file, i) => (
          <li key={`${i}-${file.name}-${file.size}`} className="flex items-center gap-3 px-3 py-2">
            {reorderable ? (
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium tabular-nums">
                {i + 1}
              </span>
            ) : (
              <FileIcon className="size-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" title={file.webkitRelativePath || file.name}>
                {file.webkitRelativePath || file.name}
              </p>
              <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
            {reorderable && (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Move up"
                  disabled={disabled || i === 0}
                  onClick={() => move(i, i - 1)}
                >
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Move down"
                  disabled={disabled || i === files.length - 1}
                  onClick={() => move(i, i + 1)}
                >
                  <ArrowDown />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${file.name}`}
              disabled={disabled}
              onClick={() => onChange(files.filter((_, j) => j !== i))}
            >
              <X />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
        <span>
          {files.length} file{files.length === 1 ? "" : "s"} · {formatBytes(total)}
        </span>
        <Button variant="ghost" size="xs" disabled={disabled} onClick={() => onChange([])}>
          Clear all
        </Button>
      </div>
    </div>
  )
}
