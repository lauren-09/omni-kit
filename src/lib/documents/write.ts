import type { Content, TDocumentDefinitions } from "pdfmake/interfaces"
import type { Block, Run, SimpleDoc } from "@/lib/documents/model"
import { escapeXml, plainText, toBase64 } from "@/lib/documents/model"
import { fitWithin } from "@/lib/image"

export function writeText(doc: SimpleDoc): Blob {
  const text = doc.blocks
    .map((block) => {
      switch (block.type) {
        case "heading":
          return block.text
        case "paragraph":
          return plainText(block.runs)
        case "pagebreak":
          return "\f"
        default:
          return null
      }
    })
    .filter((part) => part !== null)
    .join("\n\n")
  return new Blob([text + "\n"], { type: "text/plain;charset=utf-8" })
}

function runsToHtml(runs: Run[]): string {
  return runs
    .map((r) => {
      let html = escapeXml(r.text).replace(/\n/g, "<br>")
      if (r.bold) html = `<strong>${html}</strong>`
      if (r.italic) html = `<em>${html}</em>`
      return html
    })
    .join("")
}

function blockToHtml(block: Block): string {
  switch (block.type) {
    case "heading":
      return `<h${block.level}>${escapeXml(block.text)}</h${block.level}>`
    case "paragraph":
      return `<p>${runsToHtml(block.runs)}</p>`
    case "image":
      return `<img src="data:${block.mime};base64,${toBase64(block.data)}" width="${block.width}" height="${block.height}" alt="">`
    case "pagebreak":
      return `<div style="break-after: page"></div>`
  }
}

export function writeHtml(doc: SimpleDoc): Blob {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeXml(doc.title)}</title>
<style>
  body { max-width: 46rem; margin: 2rem auto; padding: 0 1rem; font: 17px/1.6 Georgia, serif; color: #1a1a1a; }
  h1, h2, h3 { font-family: system-ui, sans-serif; line-height: 1.25; }
  img { max-width: 100%; height: auto; }
</style>
</head>
<body>
${doc.blocks.map(blockToHtml).join("\n")}
</body>
</html>
`
  return new Blob([html], { type: "text/html;charset=utf-8" })
}

export async function writeDocx(doc: SimpleDoc): Promise<Blob> {
  const { Document, HeadingLevel, ImageRun, Packer, PageBreak, Paragraph, TextRun } = await import("docx")
  const headings = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3]
  const children = doc.blocks.map((block) => {
    switch (block.type) {
      case "heading":
        return new Paragraph({ heading: headings[block.level - 1], children: [new TextRun(block.text)] })
      case "paragraph":
        return new Paragraph({
          spacing: { after: 160 },
          children: block.runs.flatMap((r) =>
            r.text.split("\n").map((text, i) => new TextRun({ text, bold: r.bold, italics: r.italic, break: i > 0 ? 1 : undefined }))
          ),
        })
      case "image": {
        // Fit inside the text area of a Letter/A4 page (96-dpi pixels).
        const size = fitWithin(block.width, block.height, 620, 860)
        return new Paragraph({
          children: [new ImageRun({ type: block.mime === "image/png" ? "png" : "jpg", data: block.data, transformation: size })],
        })
      }
      case "pagebreak":
        return new Paragraph({ children: [new PageBreak()] })
    }
  })
  return Packer.toBlob(
    new Document({
      title: doc.title,
      creator: "OmniKit",
      styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
      sections: [{ children }],
    })
  )
}

/** Real PDF text (selectable and searchable), laid out by pdfmake with the bundled Roboto font. */
export async function writePdf(doc: SimpleDoc): Promise<Blob> {
  const [pdfMakeModule, vfsModule] = await Promise.all([import("pdfmake/build/pdfmake"), import("pdfmake/build/vfs_fonts")])
  // Both are CommonJS builds; the bundler exposes them on `default`.
  const pdfMake = ((pdfMakeModule as { default?: unknown }).default ?? pdfMakeModule) as typeof import("pdfmake/build/pdfmake")
  const vfs = ((vfsModule as { default?: unknown }).default ?? vfsModule) as Parameters<typeof pdfMake.addVirtualFileSystem>[0]
  pdfMake.addVirtualFileSystem(vfs)

  const content: Content[] = []
  for (const block of doc.blocks) {
    switch (block.type) {
      case "heading":
        content.push({ text: block.text, style: `h${block.level}` })
        break
      case "paragraph":
        content.push({ text: block.runs.map((r) => ({ text: r.text, bold: r.bold, italics: r.italic })), margin: [0, 0, 0, 8] })
        break
      case "image":
        content.push({ image: `data:${block.mime};base64,${toBase64(block.data)}`, fit: [483, 680], alignment: "center", margin: [0, 6, 0, 12] })
        break
      case "pagebreak":
        if (content.length) content.push({ text: "", pageBreak: "after" })
        break
    }
  }

  const definition: TDocumentDefinitions = {
    info: { title: doc.title, creator: "OmniKit" },
    pageSize: "A4",
    pageMargins: [56, 56, 56, 56],
    content,
    styles: {
      h1: { fontSize: 22, bold: true, margin: [0, 10, 0, 10] },
      h2: { fontSize: 17, bold: true, margin: [0, 8, 0, 8] },
      h3: { fontSize: 14, bold: true, margin: [0, 6, 0, 6] },
    },
    defaultStyle: { fontSize: 11, lineHeight: 1.3 },
  }
  return pdfMake.createPdf(definition).getBlob()
}
