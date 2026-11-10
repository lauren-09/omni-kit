import { useDeferredValue, useMemo, useState } from "react"
import { CircleAlert, CircleCheck } from "lucide-react"
import { ChoiceOption, SplitPanels, TextInputPanel, TextOutputPanel, ToggleOption, ToolOptions } from "@/components/text-panels"
import { attempt, describe, INDENT_OPTIONS, INDENTS, parseLoose, stringify, type IndentChoice } from "@/lib/data"

const EXAMPLE = `{name: 'Ada', languages: ['English', 'French'], active: True, score: 98.50, // relaxed syntax is fine
 address: {city: "London", zip: "N1"}, tags: ("a", "b",)}`

export default function JsonFormat() {
  const [input, setInput] = useState("")
  const [indent, setIndent] = useState<IndentChoice>("2")
  const [sortKeys, setSortKeys] = useState(false)
  const text = useDeferredValue(input)

  const result = useMemo(
    () =>
      text.trim()
        ? attempt(() => {
            const { node, strict } = parseLoose(text)
            return { output: stringify(node, { indent: INDENTS[indent], sortKeys }), strict, summary: describe(node) }
          })
        : null,
    [text, indent, sortKeys]
  )
  const parsed = result?.value

  return (
    <div className="grid gap-4">
      <ToolOptions>
        <ChoiceOption label="Indent" value={indent} onChange={setIndent} options={INDENT_OPTIONS} />
        <ToggleOption label="Sort keys A–Z" checked={sortKeys} onChange={setSortKeys} />
        {parsed && (
          <p className="ml-auto flex h-7 items-center gap-1.5 text-sm">
            {parsed.strict ? (
              <CircleCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <CircleAlert className="size-4 text-amber-600 dark:text-amber-400" />
            )}
            {parsed.strict ? "Valid JSON" : "Relaxed syntax, converted to valid JSON"}
          </p>
        )}
      </ToolOptions>
      <SplitPanels>
        <TextInputPanel
          label="JSON or array"
          value={input}
          onChange={setInput}
          placeholder="Paste JSON, a JavaScript array or object, or a Python list"
          example={EXAMPLE}
          accept=".json,.txt,.js"
          error={result?.error}
          wrap={false}
        />
        <TextOutputPanel label="Formatted" value={parsed?.output ?? ""} fileName="formatted.json" mime="application/json" meta={parsed?.summary} wrap={false} />
      </SplitPanels>
    </div>
  )
}
