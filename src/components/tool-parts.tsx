import type { ReactNode } from "react"
import { LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import type { Progress as TaskProgress } from "@/hooks/use-task"

export function OptionsCard({ children, title = "Options" }: { children: ReactNode; title?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2">{children}</CardContent>
    </Card>
  )
}

type FieldProps = {
  label: string
  htmlFor?: string
  hint?: ReactNode
  /** Right-aligned value next to the label, e.g. the current slider value. */
  value?: ReactNode
  className?: string
  children: ReactNode
}

export function Field({ label, htmlFor, hint, value, className, children }: FieldProps) {
  return (
    <div className={className ?? "grid gap-2"}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        {value !== undefined && <span className="text-sm text-muted-foreground tabular-nums">{value}</span>}
      </div>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

type RunButtonProps = {
  busy: boolean
  disabled?: boolean
  onClick: () => void
  icon?: ReactNode
  children: ReactNode
}

export function RunButton({ busy, disabled, onClick, icon, children }: RunButtonProps) {
  return (
    <Button size="lg" className="h-11 w-full text-base sm:w-auto sm:px-6" disabled={busy || disabled} onClick={onClick}>
      {busy ? <LoaderCircle className="animate-spin" /> : icon}
      {busy ? "Working…" : children}
    </Button>
  )
}

export function ProgressPanel({ progress, onCancel }: { progress: TaskProgress | null; onCancel?: () => void }) {
  if (!progress) return null
  return (
    <div className="grid gap-2 rounded-xl border bg-card p-4" aria-live="polite">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="truncate text-muted-foreground">{progress.label}</span>
        <span className="flex items-center gap-2">
          <span className="font-medium tabular-nums">{progress.value}%</span>
          {onCancel && (
            <Button variant="ghost" size="xs" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </span>
      </div>
      <Progress value={progress.value} />
    </div>
  )
}
