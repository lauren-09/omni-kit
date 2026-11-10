import { useLayoutEffect, useMemo, useRef, type ComponentProps, type CSSProperties } from "react"
import { cn } from "@/lib/utils"

/** Must match `leading-6` and `py-2` below. */
const LINE_PX = 24
const PAD_PX = 8

export type LineMarks = ReadonlyMap<number, string>

type LineEditorProps = Omit<ComponentProps<"textarea">, "value" | "onChange" | "wrap" | "className"> & {
  value: string
  /** Omit for a read-only view. */
  onChange?: (value: string) => void
  /** Background classes for whole lines, keyed by 0-based line index. */
  marks?: LineMarks
  className?: string
}

export function countLines(text: string): number {
  if (!text) return 0
  let n = 1
  for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) n++
  return n
}

/**
 * A textarea with a line-number gutter and optional per-line highlights. The textarea is
 * transparent; numbers and highlight bands sit in a layer behind it that follows its scroll.
 * Lines never wrap, so line N is always at the same height in both layers.
 */
export function LineEditor({ value, onChange, marks, className, ...props }: LineEditorProps) {
  const textarea = useRef<HTMLTextAreaElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const lineCount = Math.max(1, countLines(value))
  const numbers = useMemo(() => Array.from({ length: lineCount }, (_, i) => i + 1).join("\n"), [lineCount])
  const readOnly = !onChange

  const sync = () => {
    if (textarea.current && layer.current) layer.current.style.transform = `translateY(${-textarea.current.scrollTop}px)`
  }
  // Replacing the text (Clear, Example, Open) can move the scroll without a scroll event.
  useLayoutEffect(sync, [value])

  return (
    <div
      style={{ "--gutter": `${String(lineCount).length + 2}ch` } as CSSProperties}
      className={cn(
        "relative min-h-24 resize-y overflow-hidden rounded-lg border border-input font-mono text-[13px] leading-6 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 has-aria-invalid:border-destructive has-aria-invalid:ring-3 has-aria-invalid:ring-destructive/20",
        readOnly ? "bg-muted/40 dark:bg-muted/30" : "dark:bg-input/30",
        className
      )}
    >
      <div aria-hidden className="absolute inset-y-0 left-0 w-(--gutter) border-r bg-muted/60 dark:bg-muted/40" />
      <div ref={layer} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 will-change-transform">
        {marks &&
          [...marks].map(([line, className]) => (
            <div key={line} className={cn("absolute inset-x-0 h-6", className)} style={{ top: PAD_PX + line * LINE_PX }} />
          ))}
        <pre className="absolute top-2 left-0 w-(--gutter) pr-[1ch] text-right text-muted-foreground/70 tabular-nums">{numbers}</pre>
      </div>
      <textarea
        ref={textarea}
        value={value}
        onChange={onChange && ((e) => onChange(e.target.value))}
        readOnly={readOnly}
        wrap="off"
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        onScroll={sync}
        className="absolute inset-y-0 right-0 left-(--gutter) resize-none overflow-auto bg-transparent px-3 py-2 font-mono text-[13px] leading-6 whitespace-pre outline-none placeholder:text-muted-foreground"
        {...props}
      />
    </div>
  )
}
