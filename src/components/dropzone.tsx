import { useRef, useState } from "react"
import { FolderUp, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { matchesAccept } from "@/lib/files"
import { cn } from "@/lib/utils"

type DropzoneProps = {
  accept: string
  multiple?: boolean
  /** Human readable list of accepted formats, e.g. "JPG, PNG, WebP". */
  hint?: string
  compact?: boolean
  allowFolders?: boolean
  disabled?: boolean
  onFiles: (files: File[]) => void
}

export function Dropzone({ accept, multiple, hint, compact, allowFolders, disabled, onFiles }: DropzoneProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const folderInput = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function take(list: FileList | null, skipFilter = false) {
    const files = Array.from(list ?? [])
    const accepted = skipFilter ? files : files.filter((file) => matchesAccept(file, accept))
    const skipped = files.length - accepted.length
    if (skipped > 0) toast.warning(`Skipped ${skipped} unsupported file${skipped > 1 ? "s" : ""}.`)
    if (accepted.length > 0) onFiles(multiple ? accepted : accepted.slice(0, 1))
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && fileInput.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault()
          fileInput.current?.click()
        }
      }}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (!disabled) take(e.dataTransfer.files)
      }}
      className={cn(
        "group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-muted/30 text-center transition-colors outline-none hover:border-primary/40 hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50",
        compact ? "px-4 py-5" : "px-6 py-14",
        dragging && "border-primary bg-primary/5",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      {!compact && (
        <div className="flex size-12 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border transition-transform group-hover:-translate-y-0.5">
          <Upload className="size-5 text-muted-foreground" />
        </div>
      )}
      <div className="space-y-1">
        <p className={cn("font-medium", compact && "text-sm")}>
          {compact ? (
            <>
              <Upload className="mr-1.5 inline size-4 align-[-2px] text-muted-foreground" />
              Add more files
            </>
          ) : (
            <>Drop {multiple ? "files" : "a file"} here or <span className="text-primary underline underline-offset-4">browse</span></>
          )}
        </p>
        {hint && !compact && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {allowFolders && !compact && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            folderInput.current?.click()
          }}
        >
          <FolderUp /> Choose a folder
        </Button>
      )}
      <input
        ref={fileInput}
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          take(e.target.files)
          e.target.value = ""
        }}
        onClick={(e) => e.stopPropagation()}
      />
      {allowFolders && (
        <input
          ref={(el) => {
            folderInput.current = el
            // React has no typed prop for folder picking.
            el?.setAttribute("webkitdirectory", "")
          }}
          type="file"
          hidden
          multiple
          onChange={(e) => {
            take(e.target.files, true)
            e.target.value = ""
          }}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  )
}
