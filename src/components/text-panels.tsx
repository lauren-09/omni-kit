import { useId, useRef, type ReactNode } from "react"
import { Copy, Download, Eraser, FileUp, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { countLines, LineEditor, type LineMarks } from "@/components/line-editor"
import { plural } from "@/lib/data"
import { downloadBlob } from "@/lib/files"
import { cn } from "@/lib/utils"

const MAX_FILE_BYTES = 50 * 1024 * 1024


/** A compact row of options above the panels. */
export function ToolOptions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-x-5 gap-y-3 rounded-xl border bg-card p-3">{children}</div>
}

type ChoiceOptionProps<T extends string> = {
  label: string
  value: T
  onChange: (value: T) => void
  options: readonly (readonly [T, string])[]
  disabled?: boolean
}

export function ChoiceOption<T extends string>({ label, value, onChange, options, disabled }: ChoiceOptionProps<T>) {
  const id = useId()
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
        <SelectTrigger id={id} size="sm" className="min-w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([v, text]) => (
            <SelectItem key={v} value={v}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function ToggleOption({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const id = useId()
  return (
    <div className={cn("flex h-7 items-center gap-2", disabled && "opacity-50")}>
      <Switch id={id} size="sm" checked={checked} onCheckedChange={onChange} disabled={disabled} />
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
    </div>
  )
}

const textareaClass =
  "field-sizing-fixed h-56 resize-y font-mono text-[13px] leading-relaxed md:text-[13px] lg:h-96"

type PanelHeaderProps = { id: string; label: string; meta?: ReactNode; children?: ReactNode }

function PanelHeader({ id, label, meta, children }: PanelHeaderProps) {
  return (
    <div className="flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1">
      <Label htmlFor={id}>{label}</Label>
      {meta && <span className="text-xs text-muted-foreground tabular-nums">{meta}</span>}
      <div className="ml-auto flex items-center gap-0.5">{children}</div>
    </div>
  )
}

type TextInputPanelProps = {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Loaded by the "Example" button so people can see the tool work right away.
   *  Tools with several inputs pass a function that fills them all. */
  example?: string | (() => void)
  /** File types for "Open file", e.g. ".json,.txt". Omit to hide the button. */
  accept?: string
  error?: string | null
  wrap?: boolean
  actions?: ReactNode
  /** "sm" for tools with several inputs. */
  size?: "default" | "sm"
  /** Show a line-number gutter, optionally with highlighted lines. */
  lineNumbers?: boolean
  marks?: LineMarks
  className?: string
}

export function TextInputPanel({ label, value, onChange, placeholder, example, accept, error, wrap = true, actions, size = "default", lineNumbers, marks, className }: TextInputPanelProps) {
  const id = useId()
  const fileInput = useRef<HTMLInputElement>(null)

  async function openFile(file: File | undefined) {
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      toast.error("That file is too large. The limit is 50 MB.")
      return
    }
    onChange(await file.text())
  }

  return (
    <div className={cn("grid content-start gap-2", className)}>
      <PanelHeader id={id} label={label} meta={value ? plural(countLines(value), "line") : undefined}>
        {actions}
        {example && !value && (
          <Button variant="ghost" size="sm" onClick={() => (typeof example === "string" ? onChange(example) : example())}>
            <Sparkles /> Example
          </Button>
        )}
        {accept !== undefined && (
          <>
            <Button variant="ghost" size="sm" onClick={() => fileInput.current?.click()}>
              <FileUp /> Open
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept={accept}
              hidden
              onChange={(e) => {
                void openFile(e.target.files?.[0])
                e.target.value = ""
              }}
            />
          </>
        )}
        {value && (
          <Button variant="ghost" size="icon-sm" onClick={() => onChange("")} aria-label={`Clear ${label}`}>
            <Eraser />
          </Button>
        )}
      </PanelHeader>
      {lineNumbers ? (
        <LineEditor
          id={id}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          marks={marks}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={size === "sm" ? "h-56 lg:h-72" : "h-56 lg:h-96"}
        />
      ) : (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          wrap={wrap ? "soft" : "off"}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(textareaClass, size === "sm" && "h-40 lg:h-48")}
        />
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

type TextOutputPanelProps = {
  label?: string
  value: string
  fileName: string
  mime?: string
  /** Shown next to the label, e.g. "Array · 12 items". */
  meta?: ReactNode
  placeholder?: string
  wrap?: boolean
  lineNumbers?: boolean
  marks?: LineMarks
  className?: string
}

export function TextOutputPanel({ label = "Result", value, fileName, mime = "text/plain", meta, placeholder = "Your result appears here.", wrap = true, lineNumbers, marks, className }: TextOutputPanelProps) {
  const id = useId()

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      toast.success("Copied to clipboard")
    } catch {
      toast.error("Couldn't copy. Select the text and copy it instead.")
    }
  }

  return (
    <div className={cn("grid content-start gap-2", className)}>
      <PanelHeader id={id} label={label} meta={meta}>
        <Button variant="ghost" size="sm" onClick={() => downloadBlob(new Blob([value], { type: mime }), fileName)} disabled={!value}>
          <Download /> <span className="max-sm:sr-only">Download</span>
        </Button>
        <Button variant="secondary" size="sm" onClick={copy} disabled={!value}>
          <Copy /> Copy
        </Button>
      </PanelHeader>
      {lineNumbers ? (
        <LineEditor id={id} value={value} placeholder={placeholder} marks={marks} className="h-56 lg:h-80" />
      ) : (
        <Textarea
          id={id}
          value={value}
          readOnly
          placeholder={placeholder}
          spellCheck={false}
          wrap={wrap ? "soft" : "off"}
          className={cn(textareaClass, "bg-muted/40 dark:bg-muted/30")}
        />
      )}
    </div>
  )
}

/** Input on the left, result on the right on wide screens; stacked on phones. */
export function SplitPanels({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 lg:grid-cols-2">{children}</div>
}
