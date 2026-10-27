import type { Report } from "@/hooks/use-task"

const PX_TO_PT = 0.75

/**
 * Renders a .docx into an off-screen iframe. The iframe keeps the document's
 * styles isolated from the app's Tailwind styles (and vice versa).
 */
async function renderDocx(file: File, forPrint: boolean): Promise<HTMLIFrameElement> {
  const { renderAsync } = await import("docx-preview")
  const iframe = document.createElement("iframe")
  // Untrusted documents: no scripts (or javascript: links) may ever run in here.
  // allow-same-origin lets us read the rendered pages; allow-modals lets print() open.
  iframe.setAttribute("sandbox", "allow-same-origin allow-modals")
  iframe.setAttribute("aria-hidden", "true")
  iframe.tabIndex = -1
  iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:1400px;height:900px;border:0;"
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument!
  doc.open()
  doc.write('<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#fff"></body></html>')
  doc.close()

  try {
    await renderAsync(await file.arrayBuffer(), doc.body, doc.head, {
      inWrapper: true,
      hideWrapperOnPrint: forPrint,
      breakPages: true,
      // Honour the page breaks Word recorded when the file was last saved.
      ignoreLastRenderedPageBreak: false,
      experimental: true,
      useBase64URL: true,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
    })
  } catch {
    iframe.remove()
    throw new Error("Couldn't read this document. Only .docx files are supported (not the older .doc format).")
  }
  await doc.fonts.ready
  await Promise.all(Array.from(doc.images).map((img) => img.decode().catch(() => undefined)))
  return iframe
}

function pageSections(iframe: HTMLIFrameElement): HTMLElement[] {
  const sections = Array.from(iframe.contentDocument!.querySelectorAll<HTMLElement>("section.docx"))
  if (sections.length === 0) throw new Error("This document appears to be empty.")
  return sections
}

/** Layout-faithful DOCX → PDF: each page is rendered exactly as laid out, stored as an image. */
export async function docxToPdf(file: File, report: Report): Promise<Blob> {
  report(0.02, "Reading document…")
  const iframe = await renderDocx(file, false)
  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")])
    const sections = pageSections(iframe)
    let pdf: InstanceType<typeof jsPDF> | null = null

    for (const [i, section] of sections.entries()) {
      report(0.05 + (0.9 * i) / sections.length, `Rendering page ${i + 1} of ${sections.length}…`)
      const widthPx = section.offsetWidth
      // Sections without a stored page break can run longer than one page: slice them.
      const pageHeightPx = parseFloat(getComputedStyle(section).minHeight) || widthPx * Math.SQRT2
      const scale = 2
      const canvas = await html2canvas(section, { scale, backgroundColor: "#ffffff", logging: false, useCORS: true })
      // Small tolerance so sub-pixel rounding doesn't produce an empty trailing page.
      const slices = Math.max(1, Math.ceil(section.offsetHeight / pageHeightPx - 0.02))

      for (let s = 0; s < slices; s++) {
        const slice = document.createElement("canvas")
        slice.width = canvas.width
        slice.height = Math.min(Math.round(pageHeightPx * scale), canvas.height - Math.round(s * pageHeightPx * scale))
        slice.getContext("2d")!.drawImage(canvas, 0, -Math.round(s * pageHeightPx * scale))

        const w = widthPx * PX_TO_PT
        const h = pageHeightPx * PX_TO_PT
        const orientation = w > h ? "landscape" : "portrait"
        if (!pdf) pdf = new jsPDF({ unit: "pt", format: [w, h], orientation, compress: true })
        else pdf.addPage([w, h], orientation)
        pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, w, (slice.height / scale) * PX_TO_PT)
      }
    }
    report(1, "Saving PDF…")
    return pdf!.output("blob")
  } finally {
    iframe.remove()
  }
}

/** Uses the browser's own print engine: vector, selectable text. */
export async function printDocx(file: File) {
  const iframe = await renderDocx(file, true)
  const doc = iframe.contentDocument!
  const first = pageSections(iframe)[0]
  const style = doc.createElement("style")
  style.textContent = `@page { size: ${first.offsetWidth / 96}in ${(parseFloat(getComputedStyle(first).minHeight) || first.offsetWidth * Math.SQRT2) / 96}in; margin: 0; }
    section.docx { box-shadow: none !important; margin: 0 !important; break-after: page; }`
  doc.head.appendChild(style)
  iframe.contentWindow!.addEventListener("afterprint", () => setTimeout(() => iframe.remove(), 500))
  iframe.contentWindow!.focus()
  iframe.contentWindow!.print()
}
