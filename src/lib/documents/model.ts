/**
 * A deliberately small document model that every reader produces and every writer
 * consumes. N readers + M writers give N×M conversions without N×M converters.
 * It keeps text, headings, emphasis, images and page breaks. Tables and columns are flattened.
 */
export type Run = { text: string; bold?: boolean; italic?: boolean }

export type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  /** `\n` inside a run is a line break within the paragraph. */
  | { type: "paragraph"; runs: Run[] }
  | { type: "image"; data: Uint8Array; mime: "image/png" | "image/jpeg"; width: number; height: number }
  | { type: "pagebreak" }

export type SimpleDoc = { title: string; blocks: Block[] }

export function plainText(runs: Run[]): string {
  return runs.map((r) => r.text).join("")
}

export function isEmpty(doc: SimpleDoc): boolean {
  return !doc.blocks.some((b) => b.type === "image" || (b.type === "heading" && b.text) || (b.type === "paragraph" && plainText(b.runs).trim()))
}

export function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

export function toBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}
