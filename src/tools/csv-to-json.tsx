import { useDeferredValue, useMemo, useState } from "react"
import { ChoiceOption, SplitPanels, TextInputPanel, TextOutputPanel, ToggleOption, ToolOptions } from "@/components/text-panels"
import { attempt, csvToRows, detectDelimiter, INDENT_OPTIONS, INDENTS, plural, type IndentChoice } from "@/lib/data"

const EXAMPLE = `id,name,city,active
1,Ada Lovelace,London,true
2,"Hopper, Grace",New York,false
3,Alan Turing,"Wilmslow",true`

const DELIMITERS = [
  ["auto", "Auto-detect"],
  [",", "Comma ,"],
  [";", "Semicolon ;"],
  ["\t", "Tab"],
  ["|", "Pipe |"],
] as const

const OUTPUTS = [
  ["objects", "Array of objects"],
  ["arrays", "Array of arrays"],
] as const

type Delimiter = (typeof DELIMITERS)[number][0]

export default function CsvToJson() {
  const [input, setInput] = useState("")
  const [delimiter, setDelimiter] = useState<Delimiter>("auto")
  const [output, setOutput] = useState<"objects" | "arrays">("objects")
  const [header, setHeader] = useState(true)
  const [detectTypes, setDetectTypes] = useState(true)
  const [indent, setIndent] = useState<IndentChoice>("2")
  const text = useDeferredValue(input)

  const result = useMemo(
    () =>
      text.trim()
        ? attempt(() => {
            const d = delimiter === "auto" ? detectDelimiter(text) : delimiter
            const { value, rows, columns } = csvToRows(text, { delimiter: d, header, output, detectTypes, skipEmptyRows: true })
            return { json: JSON.stringify(value, null, INDENTS[indent]), rows, columns }
          })
        : null,
    [text, delimiter, header, output, detectTypes, indent]
  )
  const converted = result?.value

  return (
    <div className="grid gap-4">
      <ToolOptions>
        <ChoiceOption label="Delimiter" value={delimiter} onChange={setDelimiter} options={DELIMITERS} />
        <ChoiceOption label="Output" value={output} onChange={setOutput} options={OUTPUTS} />
        <ChoiceOption label="Indent" value={indent} onChange={setIndent} options={INDENT_OPTIONS} />
        <ToggleOption label="First row is header" checked={header} onChange={setHeader} disabled={output === "arrays"} />
        <ToggleOption label="Detect numbers & booleans" checked={detectTypes} onChange={setDetectTypes} />
      </ToolOptions>
      <SplitPanels>
        <TextInputPanel
          label="CSV"
          value={input}
          onChange={setInput}
          placeholder={"name,email\nAda,ada@example.com"}
          example={EXAMPLE}
          accept=".csv,.tsv,.txt"
          error={result?.error}
          wrap={false}
        />
        <TextOutputPanel
          label="JSON"
          value={converted?.json ?? ""}
          fileName="data.json"
          mime="application/json"
          meta={converted && `${plural(converted.rows, "row")} · ${plural(converted.columns, "column")}`}
          wrap={false}
        />
      </SplitPanels>
    </div>
  )
}
