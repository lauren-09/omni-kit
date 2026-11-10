import { useEffect, useRef } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type ToolSearchProps = {
  query: string
  onQueryChange: (query: string) => void
  /** Enter: open the top result. */
  onSubmit: () => void
  className?: string
}

/** Site-wide tool search in the header. "/" or Ctrl/⌘+K focuses it from anywhere. */
export function ToolSearch({ query, onQueryChange, onSubmit, className }: ToolSearchProps) {
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable='true']")
      const shortcut = (e.key === "/" && !typing) || (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey))
      if (!shortcut) return
      e.preventDefault()
      input.current?.focus()
      input.current?.select()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <div role="search" className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={input}
        type="search"
        aria-label="Search tools"
        placeholder='Search tools, e.g. "heic to jpg"'
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit()
          if (e.key === "Escape") {
            onQueryChange("")
            e.currentTarget.blur()
          }
        }}
        className="h-10 bg-muted/50 pr-10 pl-9 dark:bg-input/30"
      />
      {!query && (
        <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden h-5 -translate-y-1/2 items-center rounded border bg-background px-1.5 font-mono text-[11px] text-muted-foreground sm:inline-flex">
          /
        </kbd>
      )}
    </div>
  )
}
