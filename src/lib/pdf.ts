import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist"
import { baseName, type OutputFile } from "@/lib/files"
import { canvasToBlob } from "@/lib/image"

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null

/** Loads pdf.js (and its worker) on first use only, keeping the home page light. */
export function loadPdfJs() {
  pdfjsPromise ??= Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    return pdfjs
  })
  return pdfjsPromise
}

export async function openPdf(file: Blob): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfJs()
  try {
    return await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  } catch (err) {
    if (err instanceof pdfjs.PasswordException) {
      throw new Error("This PDF is password-protected. Remove the password first.")
    }
    throw new Error("This file doesn't look like a valid PDF.")
  }
}

export async function renderPage(page: PDFPageProxy, scale: number): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement("canvas")
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  await page.render({ canvas, viewport }).promise
  return canvas
}

/** Opens a PDF with pdf-lib, translating its errors into something readable. */
export async function loadPdfLib(file: Blob) {
  const { PDFDocument } = await import("pdf-lib")
  try {
    return await PDFDocument.load(await file.arrayBuffer())
  } catch (err) {
    const message = err instanceof Error ? err.message : ""
    if (/encrypt/i.test(message)) throw new Error("This PDF is password-protected. Remove the password first.")
    throw new Error("This file doesn't look like a valid PDF.")
  }
}

/** Renders every page to an image file. */
export async function pdfToImages(
  file: File,
  format: "image/png" | "image/jpeg",
  dpi: number,
  report: (fraction: number, label?: string) => void
): Promise<OutputFile[]> {
  const pdf = await openPdf(file)
  const out: OutputFile[] = []
  const digits = String(pdf.numPages).length
  for (let n = 1; n <= pdf.numPages; n++) {
    report((n - 1) / pdf.numPages, `${file.name}: page ${n} of ${pdf.numPages}`)
    const page = await pdf.getPage(n)
    const canvas = await renderPage(page, dpi / 72)
    page.cleanup()
    out.push({
      name: `${baseName(file.name)}-page-${String(n).padStart(digits, "0")}.${format === "image/png" ? "png" : "jpg"}`,
      blob: await canvasToBlob(canvas, format, 0.92),
      note: `${canvas.width} × ${canvas.height} px`,
    })
  }
  return out
}
