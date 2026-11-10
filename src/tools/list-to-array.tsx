import { useDeferredValue, useMemo, useState } from "react"
import { ChoiceOption, SplitPanels, TextInputPanel, TextOutputPanel, ToggleOption, ToolOptions } from "@/components/text-panels"
import { formatList, plural, splitList, SPLIT_OPTIONS, unique, type ArrayFormat, type SplitMode } from "@/lib/data"

const EXAMPLE = `apple
banana
cherry
42
banana`

const WRAPS = [
  ["brackets", "[ a, b ]"],
  ["parens", "( a, b )"],
  ["none", "a, b"],
] as const

const QUOTES = [
  ["double", '"Double"'],
  ["single", "'Single'"],
  ["none", "None"],
] as const

export default function ListToArray() {
  const [input, setInput] = useState("")
  const [split, setSplit] = useState<SplitMode>("auto")
  const [wrap, setWrap] = useState<ArrayFormat["wrap"]>("brackets")
  const [quote, setQuote] = useState<ArrayFormat["quote"]>("double")
  const [dedupe, setDedupe] = useState(false)
  const [bareNumbers, setBareNumbers] = useState(false)
  const [onePerLine, setOnePerLine] = useState(false)
  const text = useDeferredValue(input)

  const items = useMemo(() => {
    const all = splitList(text, split)
    return dedupe ? unique(all) : all
  }, [text, split, dedupe])

  const output = useMemo(
    () => (items.length ? formatList(items, { wrap, quote, bareNumbers, onePerLine, spaceAfterComma: true }) : ""),
    [items, wrap, quote, bareNumbers, onePerLine]
  )

  return (
    <div className="grid gap-4">
      <ToolOptions>
        <ChoiceOption label="Split by" value={split} onChange={setSplit} options={SPLIT_OPTIONS} />
        <ChoiceOption label="Format" value={wrap} onChange={setWrap} options={WRAPS} />
        <ChoiceOption label="Quotes" value={quote} onChange={setQuote} options={QUOTES} />
        <ToggleOption label="Remove duplicates" checked={dedupe} onChange={setDedupe} />
        <ToggleOption label="Don't quote numbers" checked={bareNumbers} onChange={setBareNumbers} disabled={quote === "none"} />
        <ToggleOption label="One per line" checked={onePerLine} onChange={setOnePerLine} />
      </ToolOptions>
      <SplitPanels>
        <TextInputPanel label="List" value={input} onChange={setInput} placeholder="One item per line" example={EXAMPLE} accept=".txt,.csv" />
        <TextOutputPanel label="Array" value={output} fileName="array.txt" meta={items.length ? plural(items.length, "item") : undefined} />
      </SplitPanels>
    </div>
  )
}
