import { useDeferredValue, useMemo, useState } from "react"
import { Plus, X } from "lucide-react"
import { ChoiceOption, TextInputPanel, TextOutputPanel, ToggleOption, ToolOptions } from "@/components/text-panels"
import { Button } from "@/components/ui/button"
import { attempt, flattenNodes, plural, readArray, sortNodes, stringify, uniqueNodes, type JsonNode } from "@/lib/data"

const MAX_ARRAYS = 10

const EXAMPLES = ['["apple", "banana", "cherry"]', '["banana", "date", 42]']

const SORTS = [
  ["none", "Keep order"],
  ["asc", "A → Z"],
  ["desc", "Z → A"],
] as const

const STYLES = [
  ["line", "One line"],
  ["min", "Minified"],
  ["pretty", "One per line"],
] as const

type Style = (typeof STYLES)[number][0]

function format(items: JsonNode[], style: Style): string {
  const array: JsonNode = { type: "array", items }
  if (style === "min") return stringify(array)
  if (style === "pretty") return stringify(array, { indent: "  " })
  return `[${items.map((n) => stringify(n)).join(", ")}]`
}

export default function ArrayMerge() {
  const [inputs, setInputs] = useState(["", ""])
  const [dedupe, setDedupe] = useState(true)
  const [flatten, setFlatten] = useState(false)
  const [sort, setSort] = useState<"none" | "asc" | "desc">("none")
  const [style, setStyle] = useState<Style>("line")
  const texts = useDeferredValue(inputs)

  const parsed = useMemo(() => texts.map((t) => attempt(() => readArray(t))), [texts])

  const merged = useMemo(() => {
    if (parsed.some((p) => p.error) || texts.every((t) => !t.trim())) return null
    let items = parsed.flatMap((p) => p.value ?? [])
    if (flatten) items = flattenNodes(items)
    const total = items.length
    if (dedupe) items = uniqueNodes(items)
    if (sort !== "none") items = sortNodes(items, sort)
    return { output: format(items, style), count: items.length, removed: total - items.length }
  }, [parsed, texts, dedupe, flatten, sort, style])

  const update = (index: number, value: string) => setInputs((all) => all.map((v, i) => (i === index ? value : v)))
  const empty = inputs.every((v) => !v)

  return (
    <div className="grid gap-4">
      <ToolOptions>
        <ChoiceOption label="Sort" value={sort} onChange={setSort} options={SORTS} />
        <ChoiceOption label="Output" value={style} onChange={setStyle} options={STYLES} />
        <ToggleOption label="Remove duplicates" checked={dedupe} onChange={setDedupe} />
        <ToggleOption label="Flatten nested arrays" checked={flatten} onChange={setFlatten} />
      </ToolOptions>

      <div className="grid gap-4 sm:grid-cols-2">
        {inputs.map((value, i) => (
          <TextInputPanel
            key={i}
            size="sm"
            label={`Array ${i + 1}`}
            value={value}
            onChange={(v) => update(i, v)}
            placeholder={'[1, 2, 3] or one item per line'}
            example={empty && i === 0 ? () => setInputs([...EXAMPLES]) : undefined}
            error={value.trim() ? parsed[i]?.error : null}
            actions={
              inputs.length > 2 && (
                <Button variant="ghost" size="icon-sm" aria-label={`Remove array ${i + 1}`} onClick={() => setInputs((all) => all.filter((_, j) => j !== i))}>
                  <X />
                </Button>
              )
            }
          />
        ))}
      </div>
      {inputs.length < MAX_ARRAYS && (
        <div>
          <Button variant="outline" onClick={() => setInputs((all) => [...all, ""])}>
            <Plus /> Add array
          </Button>
        </div>
      )}

      <TextOutputPanel
        label="Merged array"
        value={merged?.output ?? ""}
        fileName="merged.json"
        mime="application/json"
        meta={merged && `${plural(merged.count, "item")}${merged.removed ? ` · ${plural(merged.removed, "duplicate")} removed` : ""}`}
      />
    </div>
  )
}
