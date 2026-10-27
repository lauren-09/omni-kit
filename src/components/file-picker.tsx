import { Dropzone } from "@/components/dropzone"
import { FileList } from "@/components/file-list"

type FilePickerProps = {
  files: File[]
  onChange: (files: File[]) => void
  accept: string
  hint?: string
  multiple?: boolean
  reorderable?: boolean
  allowFolders?: boolean
  disabled?: boolean
}

/** A dropzone while empty, then the chosen files (plus "add more" when multiple). */
export function FilePicker({ files, onChange, multiple, reorderable, disabled, ...dropzone }: FilePickerProps) {
  if (files.length === 0) {
    return <Dropzone {...dropzone} multiple={multiple} disabled={disabled} onFiles={onChange} />
  }
  return (
    <div className="grid gap-3">
      <FileList files={files} onChange={onChange} reorderable={reorderable} disabled={disabled} />
      {multiple && (
        <Dropzone {...dropzone} compact multiple disabled={disabled} onFiles={(more) => onChange([...files, ...more])} />
      )}
    </div>
  )
}
