import { useDeferredValue, useMemo, useState } from "react"
import type { LineMarks } from "@/components/line-editor"
import { ChoiceOption, SplitPanels, TextInputPanel, TextOutputPanel, ToggleOption, ToolOptions } from "@/components/text-panels"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { compareLists, lineStatuses, plural, splitList, SPLIT_OPTIONS, type ListComparison, type SplitMode } from "@/lib/data"
import { cn } from "@/lib/utils"

const EXAMPLE_A = "apple\nbanana\ncherry\ndate\ngrape"
const EXAMPLE_B = "banana\ndate\nelderberry\nfig\ngrape"

/** Diff colours: A-only lines in red, B-only lines in green, shared lines left plain. */
const ONLY_A = "border-l-2 border-rose-500 bg-rose-500/12 dark:bg-rose-500/15"
const ONLY_B = "border-l-2 border-emerald-500 bg-emerald-500/12 dark:bg-emerald-500/15"

const VIEWS = [
  { id: "onlyA", label: "Only in A", file: "only-in-a.txt", dot: "bg-rose-500" },
  { id: "onlyB", label: "Only in B", file: "only-in-b.txt", dot: "bg-emerald-500" },
  { id: "both", label: "In both", file: "in-both.txt", dot: "bg-muted-foreground/50" },
  { id: "all", label: "All unique", file: "all-unique.txt", dot: "bg-linear-to-r from-rose-500 to-emerald-500" },
] as const satisfies readonly { id: keyof ListComparison; label: string; file: string; dot: string }[]

function marksFor(statuses: Map<number, string>, uniqueClass: string): LineMarks {
  const marks = new Map<number, string>()
  for (const [line, status] of statuses) if (status === "unique") marks.set(line, uniqueClass)
  return marks
}

function Dot({ className }: { className: string }) {
  return <span aria-hidden className={cn("inline-block size-2.5 shrink-0 rounded-full", className)} />
}

export default function ListCompare() {
  const [a, setA] = useState("")
  const [b, setB] = useState("")
  const [split, setSplit] = useState<SplitMode>("auto")
  const [ignoreCase, setIgnoreCase] = useState(false)
  const [view, setView] = useState<keyof ListComparison>("onlyA")
  const textA = useDeferredValue(a)
  const textB = useDeferredValue(b)

  const { result, marksA, marksB } = useMemo(() => {
    const itemsA = splitList(textA, split)
    const itemsB = splitList(textB, split)
    return {
      result: compareLists(itemsA, itemsB, !ignoreCase),
      marksA: marksFor(lineStatuses(textA, split, itemsB, !ignoreCase), ONLY_A),
      marksB: marksFor(lineStatuses(textB, split, itemsA, !ignoreCase), ONLY_B),
    }
  }, [textA, textB, split, ignoreCase])

  const items = result[view]
  const outputMarks = useMemo((): LineMarks => {
    if (view === "both") return new Map()
    const key = (s: string) => (ignoreCase ? s.toLowerCase() : s)
    const onlyA = new Set(result.onlyA.map(key))
    const onlyB = new Set(result.onlyB.map(key))
    const marks = new Map<number, string>()
    items.forEach((item, i) => {
      if (onlyA.has(key(item))) marks.set(i, ONLY_A)
      else if (onlyB.has(key(item))) marks.set(i, ONLY_B)
    })
    return marks
  }, [view, items, result, ignoreCase])

  const loadExample = () => {
    setA(EXAMPLE_A)
    setB(EXAMPLE_B)
  }
  const hasInput = Boolean(textA.trim() || textB.trim())
  const current = VIEWS.find((v) => v.id === view)!

  return (
    <div className="grid gap-4">
      <ToolOptions>
        <ChoiceOption label="Split by" value={split} onChange={setSplit} options={SPLIT_OPTIONS} />
        <ToggleOption label="Ignore case" checked={ignoreCase} onChange={setIgnoreCase} />
        <div className="ml-auto flex h-7 flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground" aria-label="Highlight colours">
          <span className="flex items-center gap-1.5">
            <Dot className="bg-rose-500" /> Only in A
          </span>
          <span className="flex items-center gap-1.5">
            <Dot className="bg-emerald-500" /> Only in B
          </span>
          <span className="flex items-center gap-1.5">
            <Dot className="bg-muted-foreground/40" /> In both
          </span>
        </div>
      </ToolOptions>
      <SplitPanels>
        <TextInputPanel
          label="List A"
          value={a}
          onChange={setA}
          placeholder="One item per line"
          example={!a && !b ? loadExample : undefined}
          accept=".txt,.csv"
          size="sm"
          lineNumbers
          marks={textB.trim() ? marksA : undefined}
        />
        <TextInputPanel
          label="List B"
          value={b}
          onChange={setB}
          placeholder="One item per line"
          accept=".txt,.csv"
          size="sm"
          lineNumbers
          marks={textA.trim() ? marksB : undefined}
        />
      </SplitPanels>

      <Tabs value={view} onValueChange={(v) => setView(v as keyof ListComparison)}>
        <TabsList className="h-auto! w-full flex-wrap">
          {VIEWS.map((v) => (
            <TabsTrigger key={v.id} value={v.id} className="h-8 basis-[calc(50%-2px)] sm:basis-0">
              <Dot className={v.dot} />
              {v.label}
              {hasInput && <span className="text-muted-foreground tabular-nums">{result[v.id].length}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <TextOutputPanel
        label={current.label}
        value={hasInput ? items.join("\n") : ""}
        fileName={current.file}
        meta={hasInput ? plural(items.length, "item") : undefined}
        placeholder="Paste two lists to compare them."
        lineNumbers
        marks={hasInput ? outputMarks : undefined}
      />
    </div>
  )
}
