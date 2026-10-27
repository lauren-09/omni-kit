import type { PDFPageProxy } from "pdfjs-dist"
import type { TextItem } from "pdfjs-dist/types/src/display/api"
import type { Report } from "@/hooks/use-task"
import type { Block, SimpleDoc } from "@/lib/documents/model"
import { openPdf } from "@/lib/pdf"

type Line = { y: number; size: number; text: string }

/** Groups a page's positioned text fragments into reading-order lines. */
async function extractLines(page: PDFPageProxy): Promise<Line[]> {
  const content = await page.getTextContent()
  const glyphs = content.items
    .filter((item): item is TextItem => "str" in item && item.str.length > 0)
    .map((item) => ({
      str: item.str,
      x: item.transform[4] as number,
      y: item.transform[5] as number,
      width: item.width,
      size: Math.hypot(item.transform[2], item.transform[3]) || item.height || 10,
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x)

  const rows: { y: number; size: number; parts: typeof glyphs }[] = []
  for (const glyph of glyphs) {
    const row = rows.at(-1)
    if (row && Math.abs(row.y - glyph.y) < Math.max(row.size, glyph.size) * 0.5) {
      row.parts.push(glyph)
      row.size = Math.max(row.size, glyph.size)
    } else {
      rows.push({ y: glyph.y, size: glyph.size, parts: [glyph] })
    }
  }

  return rows
    .map((row) => {
      let text = ""
      let end: number | null = null
      for (const part of row.parts.sort((a, b) => a.x - b.x)) {
        const gap = end === null ? 0 : part.x - end
        if (gap > part.size * 0.2 && !text.endsWith(" ") && !part.str.startsWith(" ")) text += " "
        text += part.str
        end = part.x + part.width
      }
      return { y: row.y, size: row.size, text: text.trim() }
    })
    .filter((line) => line.text.length > 0)
}

/** Joins consecutive lines into paragraphs, using vertical gaps and font size changes. */
function toParagraphs(lines: Line[]): Line[] {
  const paragraphs: Line[] = []
  let current: Line | null = null
  let prev: Line | null = null
  for (const line of lines) {
    const startsNew = !prev || prev.y - line.y > prev.size * 1.75 || Math.abs(line.size - prev.size) > 1.5
    if (startsNew || !current) {
      current = { ...line }
      paragraphs.push(current)
    } else if (/\w-$/.test(current.text)) {
      current.text = current.text.slice(0, -1) + line.text
    } else {
      current.text += ` ${line.text}`
    }
    prev = line
  }
  return paragraphs
}

/** The most common font size by amount of text, treated as body text. */
function bodySize(pages: Line[][]): number {
  const weight = new Map<number, number>()
  for (const line of pages.flat()) {
    const size = Math.round(line.size)
    weight.set(size, (weight.get(size) ?? 0) + line.text.length)
  }
  return [...weight.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 11
}

/** Extracts text structure from a PDF. Images and tables are not recovered. */
export async function readPdf(file: File, title: string, report: Report): Promise<SimpleDoc> {
  const pdf = await openPdf(file)
  const pages: Line[][] = []
  for (let n = 1; n <= pdf.numPages; n++) {
    report((n - 1) / pdf.numPages, `Reading text on page ${n} of ${pdf.numPages}…`)
    const page = await pdf.getPage(n)
    pages.push(toParagraphs(await extractLines(page)))
    page.cleanup()
  }
  if (pages.every((p) => p.length === 0)) {
    throw new Error("This PDF has no selectable text (it's probably a scan), so there's no text to convert.")
  }

  const body = bodySize(pages)
  const blocks: Block[] = []
  pages.forEach((paragraphs, i) => {
    if (i > 0) blocks.push({ type: "pagebreak" })
    for (const p of paragraphs) {
      if (p.size >= body * 1.6) blocks.push({ type: "heading", level: 1, text: p.text })
      else if (p.size >= body * 1.2) blocks.push({ type: "heading", level: 2, text: p.text })
      else blocks.push({ type: "paragraph", runs: [{ text: p.text }] })
    }
  })
  const info = (await pdf.getMetadata().catch(() => null))?.info as { Title?: string } | undefined
  return { title: info?.Title?.trim() || title, blocks }
}
