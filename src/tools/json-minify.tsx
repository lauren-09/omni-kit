import { useDeferredValue, useMemo, useState } from "react"
import { SplitPanels, TextInputPanel, TextOutputPanel } from "@/components/text-panels"
import { attempt, byteLength, parseLoose, stringify } from "@/lib/data"
import { formatBytes } from "@/lib/files"

const EXAMPLE = `{
  "name": "OmniKit",
  "tags": ["json", "array", "minify"],
  "settings": {
    "theme": "dark",
    "items": [1, 2, 3],
  },
}`

export default function JsonMinify() {
  const [input, setInput] = useState("")
  const text = useDeferredValue(input)

  const result = useMemo(
    () =>
      text.trim()
        ? attempt(() => {
            const { node, strict } = parseLoose(text)
            return { output: stringify(node), strict }
          })
        : null,
    [text]
  )

  const output = result?.value?.output ?? ""
  const before = byteLength(text)
  const after = byteLength(output)
  const saved = before ? Math.round((1 - after / before) * 100) : 0

  return (
    <SplitPanels>
      <TextInputPanel
        label="JSON or array"
        value={input}
        onChange={setInput}
        placeholder={'{"key": "value"} or [1, 2, 3]'}
        example={EXAMPLE}
        accept=".json,.txt,.js"
        error={result?.error}
        wrap={false}
      />
      <TextOutputPanel
        label="Minified"
        value={output}
        fileName="minified.json"
        mime="application/json"
        meta={
          output &&
          `${formatBytes(before)} → ${formatBytes(after)}${saved > 0 ? ` · −${saved}%` : ""}${result?.value?.strict ? "" : " · fixed to valid JSON"}`
        }
      />
    </SplitPanels>
  )
}
