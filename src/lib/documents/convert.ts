import type { Report } from "@/hooks/use-task"
import { docxToPdf } from "@/lib/documents/docx-render"
import { readEpub, writeEpub } from "@/lib/documents/epub"
import { isEmpty, type SimpleDoc } from "@/lib/documents/model"
import { readDocx, readHtmlString, readMarkdown, readText } from "@/lib/documents/read-html"
import { readPdf } from "@/lib/documents/read-pdf"
import { writeDocx, writeHtml, writePdf, writeText } from "@/lib/documents/write"
import { baseName, withExt, type OutputFile } from "@/lib/files"
import { pdfToImages } from "@/lib/pdf"

export type DocFormat = "pdf" | "docx" | "epub" | "txt" | "md" | "html"
export type DocOutput = "pdf" | "docx" | "epub" | "txt" | "html" | "jpg" | "png"

export const INPUT_EXTENSIONS: Record<DocFormat, string[]> = {
  pdf: [".pdf"],
  docx: [".docx"],
  epub: [".epub"],
  txt: [".txt"],
  md: [".md", ".markdown"],
  html: [".html", ".htm", ".xhtml"],
}

export const OUTPUTS: Record<DocOutput, { label: string; detail: string }> = {
  pdf: { label: "PDF", detail: "Print-ready, opens anywhere" },
  docx: { label: "Word (DOCX)", detail: "Editable in Word or Google Docs" },
  epub: { label: "EPUB", detail: "Ebook for Kindle, Apple Books and Kobo" },
  txt: { label: "Plain text (TXT)", detail: "Just the words" },
  html: { label: "Web page (HTML)", detail: "Opens in any browser" },
  jpg: { label: "JPG images", detail: "One image per page" },
  png: { label: "PNG images", detail: "One image per page, lossless" },
}

export function detectFormat(file: File): DocFormat | null {
  const name = file.name.toLowerCase()
  for (const [format, exts] of Object.entries(INPUT_EXTENSIONS)) {
    if (exts.some((ext) => name.endsWith(ext))) return format as DocFormat
  }
  return null
}

export function acceptFor(inputs: DocFormat[]): string {
  return inputs.flatMap((format) => INPUT_EXTENSIONS[format]).join(",")
}

/** Outputs that make sense for a given input (page images only exist for PDFs). */
export function outputsFor(input: DocFormat, allowed: DocOutput[]): DocOutput[] {
  return allowed.filter((out) => (out === "jpg" || out === "png" ? input === "pdf" : out !== input))
}

async function readDocument(file: File, format: DocFormat, report: Report): Promise<SimpleDoc> {
  const title = baseName(file.name)
  switch (format) {
    case "pdf":
      return readPdf(file, title, report)
    case "docx":
      return readDocx(file, title)
    case "epub":
      return readEpub(file, title)
    case "md":
      return readMarkdown(file, title)
    case "html":
      return readHtmlString(await file.text(), title)
    case "txt":
      return readText(file, title)
  }
}

async function writeDocument(doc: SimpleDoc, output: Exclude<DocOutput, "jpg" | "png">): Promise<Blob> {
  switch (output) {
    case "pdf":
      return writePdf(doc)
    case "docx":
      return writeDocx(doc)
    case "epub":
      return writeEpub(doc)
    case "html":
      return writeHtml(doc)
    case "txt":
      return writeText(doc)
  }
}

export async function convertDocument(file: File, output: DocOutput, report: Report): Promise<OutputFile[]> {
  const input = detectFormat(file)
  if (!input) throw new Error(`${file.name}: unsupported file type.`)

  // Special paths that keep the original page layout.
  if (input === "pdf" && (output === "jpg" || output === "png")) {
    return pdfToImages(file, output === "png" ? "image/png" : "image/jpeg", 150, report)
  }
  if (output === "jpg" || output === "png") throw new Error("Page images can only be made from PDFs.")
  if (input === "docx" && output === "pdf") {
    return [{ name: withExt(file.name, "pdf"), blob: await docxToPdf(file, report) }]
  }

  const doc = await readDocument(file, input, report)
  if (isEmpty(doc)) throw new Error(`${file.name}: no text or images found to convert.`)
  report(0.95, `Writing ${OUTPUTS[output].label}…`)
  return [{ name: withExt(file.name, output), blob: await writeDocument(doc, output) }]
}
