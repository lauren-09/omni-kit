import { decodeImage, encodeImage, fitWithin } from "@/lib/image"
import type { Block, Run, SimpleDoc } from "@/lib/documents/model"

/** Returns the bytes behind an <img src>, or null if it can't be resolved. */
export type ImageResolver = (src: string) => Promise<Blob | null>

const BLOCK_TAGS = new Set([
  "p", "div", "section", "article", "main", "header", "footer", "aside", "nav", "blockquote", "pre",
  "ul", "ol", "dl", "dt", "dd", "table", "thead", "tbody", "tfoot", "figure", "figcaption", "address", "body",
])
const SKIP_TAGS = new Set(["script", "style", "head", "title", "noscript", "template", "button", "input", "select"])
const MAX_IMAGE_SIDE = 1600

export const dataUrlResolver: ImageResolver = async (src) =>
  src.startsWith("data:") ? fetch(src).then((r) => r.blob()).catch(() => null) : null

/** Re-encodes any image to PNG/JPEG (what DOCX, PDF and EPUB writers all accept). */
export async function toImageBlock(blob: Blob): Promise<Block | null> {
  try {
    const decoded = await decodeImage(blob)
    const { width, height } = fitWithin(decoded.width, decoded.height, MAX_IMAGE_SIDE, MAX_IMAGE_SIDE)
    decoded.close()
    const mime = blob.type === "image/jpeg" ? "image/jpeg" : "image/png"
    const encoded = await encodeImage(blob, { type: mime, quality: 0.9, resize: () => ({ width, height }) })
    return { type: "image", data: new Uint8Array(await encoded.arrayBuffer()), mime, width, height }
  } catch {
    return null // A broken image shouldn't fail the whole document.
  }
}

/** Walks an HTML/XHTML tree and turns it into blocks. */
export async function readHtmlElement(root: Element, resolve: ImageResolver = dataUrlResolver): Promise<Block[]> {
  const blocks: Block[] = []
  let runs: Run[] = []

  function flush() {
    // Trim the paragraph's outer whitespace and merge neighbouring runs with the same style.
    const merged: Run[] = []
    for (const run of runs) {
      const last = merged.at(-1)
      if (last && !!last.bold === !!run.bold && !!last.italic === !!run.italic) last.text += run.text
      else merged.push({ ...run })
    }
    if (merged.length) {
      merged[0].text = merged[0].text.replace(/^[ \t]+/, "")
      merged[merged.length - 1].text = merged[merged.length - 1].text.replace(/[ \t\n]+$/, "")
    }
    if (merged.some((r) => r.text.trim())) blocks.push({ type: "paragraph", runs: merged.filter((r) => r.text) })
    runs = []
  }

  function pageBreak() {
    if (blocks.length && blocks.at(-1)!.type !== "pagebreak") blocks.push({ type: "pagebreak" })
  }

  async function walk(node: Node, bold: boolean, italic: boolean) {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = (child.textContent ?? "").replace(/\s+/g, " ")
        if (text) runs.push({ text, bold, italic })
        continue
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue
      const el = child as HTMLElement
      const tag = el.localName.toLowerCase()
      if (SKIP_TAGS.has(tag)) continue

      const style = el.getAttribute("style") ?? ""
      if (/page-break-before:\s*always|break-before:\s*page/i.test(style)) {
        flush()
        pageBreak()
      }

      if (/^h[1-6]$/.test(tag)) {
        flush()
        const text = (el.textContent ?? "").replace(/\s+/g, " ").trim()
        if (text) blocks.push({ type: "heading", level: Math.min(3, Number(tag[1])) as 1 | 2 | 3, text })
      } else if (tag === "br") {
        runs.push({ text: "\n", bold, italic })
      } else if (tag === "hr") {
        flush()
      } else if (tag === "img" || tag === "image") {
        const src = el.getAttribute("src") ?? el.getAttribute("href") ?? el.getAttribute("xlink:href") ?? ""
        const blob = src ? await resolve(src) : null
        const image = blob ? await toImageBlock(blob) : null
        if (image) {
          flush()
          blocks.push(image)
        }
      } else if (tag === "li") {
        flush()
        const parent = el.parentElement
        const index = parent ? Array.from(parent.children).filter((c) => c.localName === "li").indexOf(el) + 1 : 1
        runs.push({ text: parent?.localName === "ol" ? `${index}. ` : "• " })
        await walk(el, bold, italic)
        flush()
      } else if (tag === "tr") {
        flush()
        const cells = Array.from(el.children).map((cell) => (cell.textContent ?? "").replace(/\s+/g, " ").trim())
        if (cells.some(Boolean)) runs.push({ text: cells.join("   "), bold: bold || el.querySelector("th") !== null, italic })
        flush()
      } else if (tag === "svg") {
        // Inline SVG is usually a cover wrapper around an <image>.
        await walk(el, bold, italic)
      } else if (BLOCK_TAGS.has(tag)) {
        flush()
        await walk(el, bold, italic)
        flush()
      } else {
        await walk(el, bold || tag === "b" || tag === "strong", italic || tag === "i" || tag === "em")
      }
    }
  }

  await walk(root, false, false)
  flush()
  while (blocks.at(-1)?.type === "pagebreak") blocks.pop()
  return blocks
}

export async function readHtmlString(html: string, title: string, resolve?: ImageResolver): Promise<SimpleDoc> {
  const doc = new DOMParser().parseFromString(html, "text/html")
  return { title: doc.title.trim() || title, blocks: await readHtmlElement(doc.body, resolve) }
}

export async function readDocx(file: File, title: string): Promise<SimpleDoc> {
  const mammoth = await import("mammoth")
  let html: string
  try {
    html = (await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() })).value
  } catch {
    throw new Error("Couldn't read this document. Only .docx files are supported (not the older .doc format).")
  }
  return readHtmlString(html, title)
}

export async function readMarkdown(file: File, title: string): Promise<SimpleDoc> {
  const { marked } = await import("marked")
  return readHtmlString(await marked.parse(await file.text()), title)
}

export async function readText(file: File, title: string): Promise<SimpleDoc> {
  const text = (await file.text()).replace(/\r\n?/g, "\n")
  const blocks: Block[] = text
    .split(/\n\s*\n/)
    .map((chunk) => chunk.replace(/^\n+|\s+$/g, ""))
    .filter(Boolean)
    .map((chunk) => (chunk.includes("\f") ? { type: "pagebreak" } : { type: "paragraph", runs: [{ text: chunk }] }))
  return { title, blocks }
}
