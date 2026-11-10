/**
 * Pure helpers behind the Data tools: a forgiving JSON/array parser, a serializer that keeps
 * number literals exactly as written, list splitting, CSV parsing and list comparison.
 * Nothing here uses eval, so it works under the site's Content Security Policy.
 */

export type JsonNode =
  | { type: "object"; entries: [string, JsonNode][] }
  | { type: "array"; items: JsonNode[] }
  | { type: "string"; value: string }
  /** Kept as written so large integers and decimals never lose precision. */
  | { type: "number"; raw: string }
  | { type: "boolean"; value: boolean }
  | { type: "null" }

export class ParseError extends Error {
  readonly line: number
  readonly column: number

  constructor(message: string, line: number, column: number) {
    super(`${message} (line ${line}, column ${column})`)
    this.name = "ParseError"
    this.line = line
    this.column = column
  }
}

const NUMBER = /[+-]?(?:0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|Infinity|NaN)/y
const IDENT = /[A-Za-z_$][\w$]*/y
const BARE_KEY = /[\w$.-]+/y
const WHITESPACE = /[\s﻿ ]/

const KEYWORDS: Record<string, JsonNode> = {
  true: { type: "boolean", value: true },
  True: { type: "boolean", value: true },
  TRUE: { type: "boolean", value: true },
  false: { type: "boolean", value: false },
  False: { type: "boolean", value: false },
  FALSE: { type: "boolean", value: false },
  null: { type: "null" },
  Null: { type: "null" },
  NULL: { type: "null" },
  None: { type: "null" },
  nil: { type: "null" },
  undefined: { type: "null" },
}

/**
 * Accepts strict JSON plus the array and object syntax people paste from code: single quotes,
 * unquoted keys, trailing commas, comments, Python tuples `( )`, True/False/None.
 */
class Parser {
  private i = 0
  private readonly src: string

  constructor(src: string) {
    this.src = src
  }

  parseDocument(): JsonNode {
    const node = this.value()
    this.skip()
    if (this.i < this.src.length) this.fail("Unexpected content after the end of the value")
    return node
  }

  private fail(message: string, at = this.i): never {
    const before = this.src.slice(0, at)
    const line = before.split("\n").length
    const column = at - before.lastIndexOf("\n")
    throw new ParseError(message, line, column)
  }

  private skip() {
    const src = this.src
    while (this.i < src.length) {
      const c = src[this.i]
      if (WHITESPACE.test(c)) {
        this.i++
      } else if (c === "/" && src[this.i + 1] === "/") {
        const end = src.indexOf("\n", this.i)
        this.i = end === -1 ? src.length : end + 1
      } else if (c === "/" && src[this.i + 1] === "*") {
        const end = src.indexOf("*/", this.i + 2)
        if (end === -1) this.fail("Unterminated comment")
        this.i = end + 2
      } else {
        break
      }
    }
  }

  private match(re: RegExp): string | null {
    re.lastIndex = this.i
    const m = re.exec(this.src)
    if (!m) return null
    this.i += m[0].length
    return m[0]
  }

  private value(): JsonNode {
    this.skip()
    const c = this.src[this.i]
    if (c === undefined) this.fail("Unexpected end of input")
    if (c === "{") return this.object()
    if (c === "[") return this.array("]")
    if (c === "(") return this.array(")")
    if (c === '"' || c === "'" || c === "`") return { type: "string", value: this.string() }

    const start = this.i
    const num = this.match(NUMBER)
    if (num !== null) return { type: "number", raw: num }
    const word = this.match(IDENT)
    if (word !== null) {
      if (word in KEYWORDS) return KEYWORDS[word]
      this.fail(`Unexpected word "${word}". Text values need quotes`, start)
    }
    this.fail(`Unexpected character "${c}"`)
  }

  private array(close: "]" | ")"): JsonNode {
    this.i++
    const items: JsonNode[] = []
    for (;;) {
      this.skip()
      if (this.src[this.i] === close) {
        this.i++
        return { type: "array", items }
      }
      items.push(this.value())
      this.skip()
      const c = this.src[this.i]
      if (c === ",") this.i++
      else if (c === close) continue
      else this.fail(c === undefined ? `Missing closing "${close}"` : `Expected "," or "${close}"`)
    }
  }

  private object(): JsonNode {
    this.i++
    const entries: [string, JsonNode][] = []
    for (;;) {
      this.skip()
      const c = this.src[this.i]
      if (c === "}") {
        this.i++
        return { type: "object", entries }
      }
      let key: string
      if (c === '"' || c === "'" || c === "`") key = this.string()
      else {
        const bare = this.match(BARE_KEY)
        if (bare === null) this.fail(c === undefined ? 'Missing closing "}"' : "Expected a property name")
        key = bare
      }
      this.skip()
      if (this.src[this.i] !== ":") this.fail('Expected ":" after the property name')
      this.i++
      entries.push([key, this.value()])
      this.skip()
      const next = this.src[this.i]
      if (next === ",") this.i++
      else if (next === "}") continue
      else this.fail(next === undefined ? 'Missing closing "}"' : 'Expected "," or "}"')
    }
  }

  private string(): string {
    const src = this.src
    const quote = src[this.i]
    const start = this.i
    this.i++
    let out = ""
    let run = this.i
    while (this.i < src.length) {
      const c = src[this.i]
      if (c === quote) {
        out += src.slice(run, this.i)
        this.i++
        return out
      }
      if (c === "\n" && quote !== "`") break
      if (c !== "\\") {
        this.i++
        continue
      }
      out += src.slice(run, this.i)
      const e = src[this.i + 1]
      this.i += 2
      switch (e) {
        case "n": out += "\n"; break
        case "t": out += "\t"; break
        case "r": out += "\r"; break
        case "b": out += "\b"; break
        case "f": out += "\f"; break
        case "v": out += "\v"; break
        case "0": out += "\0"; break
        case "\r": if (src[this.i] === "\n") this.i++; break
        case "\n": break
        case "u": {
          const braced = src[this.i] === "{"
          const hex = braced ? src.slice(this.i + 1, src.indexOf("}", this.i)) : src.slice(this.i, this.i + 4)
          if (!/^[0-9a-fA-F]{1,6}$/.test(hex) || (!braced && hex.length !== 4)) this.fail("Invalid \\u escape", this.i - 2)
          out += String.fromCodePoint(parseInt(hex, 16))
          this.i += braced ? hex.length + 2 : 4
          break
        }
        case "x": {
          const hex = src.slice(this.i, this.i + 2)
          if (!/^[0-9a-fA-F]{2}$/.test(hex)) this.fail("Invalid \\x escape", this.i - 2)
          out += String.fromCharCode(parseInt(hex, 16))
          this.i += 2
          break
        }
        case undefined: this.fail("Unterminated string", start)
        default: out += e
      }
      run = this.i
    }
    this.fail("Unterminated string", start)
  }
}

export type Parsed = { node: JsonNode; strict: boolean }

/** Parses JSON or a JS/Python-style array or object. Throws ParseError with a line and column. */
export function parseLoose(text: string): Parsed {
  if (!text.trim()) throw new ParseError("Nothing to parse", 1, 1)
  const node = new Parser(text).parseDocument()
  let strict = true
  try {
    JSON.parse(text)
  } catch {
    strict = false
  }
  return { node, strict }
}

const JSON_NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/

function numberToJson(raw: string): string {
  if (JSON_NUMBER.test(raw)) return raw
  const negative = raw.startsWith("-")
  const n = Number(raw.replace(/^[+-]/, ""))
  if (!Number.isFinite(n)) return "null" // NaN and Infinity have no JSON form
  return (negative && n !== 0 ? "-" : "") + String(n)
}

export type StringifyOptions = {
  /** "" for minified output, otherwise the indent unit ("  ", "    ", "\t"). */
  indent?: string
  sortKeys?: boolean
}

export function stringify(node: JsonNode, { indent = "", sortKeys = false }: StringifyOptions = {}): string {
  const colon = indent ? ": " : ":"
  const write = (n: JsonNode, depth: string): string => {
    switch (n.type) {
      case "string": return JSON.stringify(n.value)
      case "number": return numberToJson(n.raw)
      case "boolean": return String(n.value)
      case "null": return "null"
      case "array": {
        if (n.items.length === 0) return "[]"
        const inner = depth + indent
        const parts = n.items.map((item) => write(item, inner))
        return indent ? `[\n${inner}${parts.join(`,\n${inner}`)}\n${depth}]` : `[${parts.join(",")}]`
      }
      case "object": {
        if (n.entries.length === 0) return "{}"
        const inner = depth + indent
        const entries = sortKeys ? [...n.entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)) : n.entries
        const parts = entries.map(([k, v]) => `${JSON.stringify(k)}${colon}${write(v, inner)}`)
        return indent ? `{\n${inner}${parts.join(`,\n${inner}`)}\n${depth}}` : `{${parts.join(",")}}`
      }
    }
  }
  return write(node, "")
}

/** A one-line summary such as "Array · 12 items". */
export function describe(node: JsonNode): string {
  const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`
  switch (node.type) {
    case "array": return `Array · ${plural(node.items.length, "item")}`
    case "object": return `Object · ${plural(node.entries.length, "key")}`
    case "string": return "String"
    case "number": return "Number"
    case "boolean": return "Boolean"
    case "null": return "Null"
  }
}

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

// ---------------------------------------------------------------- Lists

export type SplitMode = "auto" | "lines" | "commas" | "tabs" | "spaces"

export type SplitOptions = { trim?: boolean; skipEmpty?: boolean }

/** The text form of a primitive array item, e.g. for comparing lists pasted as arrays. */
function itemText(node: JsonNode): string {
  if (node.type === "string") return node.value
  if (node.type === "number") return node.raw
  return stringify(node)
}

function unquote(item: string): string {
  return /^(['"`]).*\1$/s.test(item) && item.length >= 2 ? item.slice(1, -1) : item
}

/**
 * Splits pasted text into items. "auto" reads an array literal if it is one, otherwise splits
 * on new lines plus commas or tabs, honouring quotes.
 */
export function splitList(text: string, mode: SplitMode = "auto", { trim = true, skipEmpty = true }: SplitOptions = {}): string[] {
  let items: string[]
  const source = text.replace(/\r\n?/g, "\n")

  if (mode === "auto") {
    const t = source.trim()
    let parsed: JsonNode | null = null
    if (/^[[(][\s\S]*[\])]$/.test(t)) {
      try {
        parsed = parseLoose(t).node
      } catch {
        parsed = null
      }
    }
    if (parsed?.type === "array") {
      items = parsed.items.map(itemText)
    } else {
      const delimiter = source.includes("\t") ? "\t" : source.includes(",") ? "," : null
      items = (delimiter ? parseCsv(source, delimiter).flat() : source.split("\n")).map((s) => unquote(trim ? s.trim() : s))
    }
  } else if (mode === "lines") {
    items = source.split("\n")
  } else if (mode === "commas") {
    items = parseCsv(source, ",").flat()
  } else if (mode === "tabs") {
    items = source.split(/[\t\n]/)
  } else {
    items = source.split(/\s+/)
  }

  if (trim) items = items.map((s) => s.trim())
  if (skipEmpty) items = items.filter((s) => s !== "")
  return items
}

export function unique(items: string[], caseSensitive = true): string[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = caseSensitive ? item : item.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export type ArrayFormat = {
  wrap: "none" | "brackets" | "parens"
  quote: "none" | "single" | "double"
  /** Leave numbers unquoted, e.g. [1, 2, "three"]. */
  bareNumbers: boolean
  spaceAfterComma: boolean
  onePerLine: boolean
}

const PLAIN_NUMBER = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/

export function formatList(items: string[], f: ArrayFormat): string {
  const quoted = items.map((item) => {
    if (f.quote === "none" || (f.bareNumbers && PLAIN_NUMBER.test(item))) return item
    if (f.quote === "double") return JSON.stringify(item)
    return `'${item.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n")}'`
  })
  const [open, close] = f.wrap === "brackets" ? ["[", "]"] : f.wrap === "parens" ? ["(", ")"] : ["", ""]
  if (f.onePerLine) {
    const pad = open ? "  " : ""
    const body = quoted.map((q) => pad + q).join(",\n")
    return open ? `${open}\n${body}\n${close}` : body
  }
  return open + quoted.join(f.spaceAfterComma ? ", " : ",") + close
}

export type ListComparison = { onlyA: string[]; onlyB: string[]; both: string[]; all: string[] }

export function compareLists(a: string[], b: string[], caseSensitive: boolean): ListComparison {
  const key = (s: string) => (caseSensitive ? s : s.toLowerCase())
  const ua = unique(a, caseSensitive)
  const ub = unique(b, caseSensitive)
  const inA = new Set(ua.map(key))
  const inB = new Set(ub.map(key))
  return {
    onlyA: ua.filter((s) => !inB.has(key(s))),
    onlyB: ub.filter((s) => !inA.has(key(s))),
    both: ua.filter((s) => inB.has(key(s))),
    all: unique([...ua, ...ub], caseSensitive),
  }
}

// ---------------------------------------------------------------- Arrays

/** Reads an array literal, or falls back to a plain list where each line or comma is one item. */
export function readArray(text: string): JsonNode[] {
  const t = text.trim()
  if (!t) return []
  if (/^[[({]/.test(t)) {
    const { node } = parseLoose(t)
    return node.type === "array" ? node.items : [node]
  }
  return splitList(t, "auto").map((item): JsonNode => {
    try {
      return parseLoose(item).node
    } catch {
      return { type: "string", value: item } // plain text, not a literal
    }
  })
}

export function flattenNodes(items: JsonNode[]): JsonNode[] {
  return items.flatMap((n) => (n.type === "array" ? flattenNodes(n.items) : [n]))
}

export function uniqueNodes(items: JsonNode[]): JsonNode[] {
  const seen = new Set<string>()
  return items.filter((n) => {
    const key = stringify(n, { sortKeys: true })
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })

export function sortNodes(items: JsonNode[], direction: "asc" | "desc"): JsonNode[] {
  const sorted = [...items].sort((a, b) => {
    if (a.type === "number" && b.type === "number") return Number(numberToJson(a.raw)) - Number(numberToJson(b.raw))
    if (a.type === "number") return -1
    if (b.type === "number") return 1
    return collator.compare(itemText(a), itemText(b))
  })
  return direction === "desc" ? sorted.reverse() : sorted
}

// ---------------------------------------------------------------- CSV

export const CSV_DELIMITERS = [",", ";", "\t", "|"] as const

/** Picks the delimiter that appears most often in the first line, outside quotes. */
export function detectDelimiter(text: string): string {
  const firstLine = text.replace(/"[^"]*"/g, "").split(/\r?\n/, 1)[0] ?? ""
  let best = ","
  let bestCount = 0
  for (const d of CSV_DELIMITERS) {
    const count = firstLine.split(d).length - 1
    if (count > bestCount) {
      best = d
      bestCount = count
    }
  }
  return best
}

/** RFC 4180 parsing: quoted fields, doubled quotes, and line breaks inside quotes. */
export function parseCsv(text: string, delimiter: string): string[][] {
  const src = text.replace(/^﻿/, "")
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let i = 0
  let quoted = false
  let fieldStart = true

  const endField = () => {
    row.push(field)
    field = ""
    fieldStart = true
  }
  const endRow = () => {
    endField()
    rows.push(row)
    row = []
  }

  while (i < src.length) {
    const c = src[i]
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        quoted = false
        i++
        continue
      }
      field += c
      i++
      continue
    }
    // Spaces before an opening quote are allowed, as in `a, "b, c"`.
    if (c === '"' && (fieldStart || /^ +$/.test(field))) {
      quoted = true
      fieldStart = false
      field = ""
      i++
    } else if (c === delimiter) {
      endField()
      i++
    } else if (c === "\n" || c === "\r") {
      endRow()
      i += c === "\r" && src[i + 1] === "\n" ? 2 : 1
    } else {
      field += c
      fieldStart = false
      i++
    }
  }
  if (field !== "" || row.length > 0 || !fieldStart) endRow()
  return rows
}

export type CsvToJsonOptions = {
  delimiter: string
  header: boolean
  output: "objects" | "arrays"
  /** Turn "42", "3.5", "true" and "false" into numbers and booleans. */
  detectTypes: boolean
  skipEmptyRows: boolean
}

function typed(value: string): unknown {
  if (value === "true" || value === "TRUE") return true
  if (value === "false" || value === "FALSE") return false
  if (JSON_NUMBER.test(value)) {
    const n = Number(value)
    // Keep long IDs as text so they don't lose digits.
    if (Number.isFinite(n) && (!Number.isInteger(n) || Number.isSafeInteger(n))) return n
  }
  return value
}

function headerNames(row: string[], width: number): string[] {
  const seen = new Map<string, number>()
  return Array.from({ length: width }, (_, i) => {
    const base = row[i]?.trim() || `column_${i + 1}`
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    return count ? `${base}_${count + 1}` : base
  })
}

export function csvToRows(text: string, o: CsvToJsonOptions): { value: unknown[]; rows: number; columns: number } {
  let rows = parseCsv(text, o.delimiter)
  if (o.skipEmptyRows) rows = rows.filter((r) => r.some((cell) => cell.trim() !== ""))
  const columns = rows.reduce((max, r) => Math.max(max, r.length), 0)
  const cell = (v: string) => (o.detectTypes ? typed(v) : v)

  if (o.output === "arrays") {
    return { value: rows.map((r) => r.map(cell)), rows: rows.length, columns }
  }
  const keys = headerNames(o.header ? (rows[0] ?? []) : [], columns)
  const body = o.header ? rows.slice(1) : rows
  const value = body.map((r) => Object.fromEntries(keys.map((k, i) => [k, cell(r[i] ?? "")])))
  return { value, rows: body.length, columns }
}

// ---------------------------------------------------------------- UI helpers

export type IndentChoice = "2" | "4" | "tab" | "min"

export const INDENT_OPTIONS = [
  ["2", "2 spaces"],
  ["4", "4 spaces"],
  ["tab", "Tabs"],
  ["min", "Minified"],
] as const satisfies readonly (readonly [IndentChoice, string])[]

export const INDENTS: Record<IndentChoice, string> = { "2": "  ", "4": "    ", tab: "\t", min: "" }

export const SPLIT_OPTIONS = [
  ["auto", "Auto"],
  ["lines", "New lines"],
  ["commas", "Commas"],
  ["tabs", "Tabs"],
  ["spaces", "Spaces"],
] as const satisfies readonly (readonly [SplitMode, string])[]

export type Attempt<T> = { value: T; error: null } | { value: null; error: string }

/** Runs a computation for live results, turning a thrown error into a message. */
export function attempt<T>(fn: () => T): Attempt<T> {
  try {
    return { value: fn(), error: null }
  } catch (err) {
    return { value: null, error: err instanceof Error ? err.message : String(err) }
  }
}

export const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`

export type LineStatus = "unique" | "shared"

/**
 * For each line of a list, whether the items on it also appear in the other list. Lines that
 * hold no list items (blank lines, the "[" of a pasted array) are left out.
 */
export function lineStatuses(text: string, split: SplitMode, other: string[], caseSensitive: boolean): Map<number, LineStatus> {
  const key = (s: string) => (caseSensitive ? s : s.toLowerCase())
  const own = new Set(splitList(text, split).map(key))
  const theirs = new Set(other.map(key))
  const statuses = new Map<number, LineStatus>()
  text.split("\n").forEach((line, i) => {
    const keys = splitList(line, split).map(key).filter((k) => own.has(k))
    if (keys.length) statuses.set(i, keys.some((k) => !theirs.has(k)) ? "unique" : "shared")
  })
  return statuses
}
