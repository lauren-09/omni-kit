import type { Block, SimpleDoc } from "@/lib/documents/model"
import { escapeXml } from "@/lib/documents/model"
import { readHtmlElement } from "@/lib/documents/read-html"
import { bytesToBlob } from "@/lib/files"

const IMAGE_MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
}

/** Resolves `href` relative to the file at `from` inside the archive. */
function resolvePath(from: string, href: string): string {
  const parts = from.split("/").slice(0, -1)
  for (const segment of decodeURIComponent(href.split("#")[0]).split("/")) {
    if (segment === "..") parts.pop()
    else if (segment && segment !== ".") parts.push(segment)
  }
  return parts.join("/")
}

function parseXml(text: string, type: DOMParserSupportedType): Document {
  const doc = new DOMParser().parseFromString(text, type)
  // Plenty of EPUBs contain slightly invalid XHTML; fall back to the forgiving HTML parser.
  return doc.querySelector("parsererror") ? new DOMParser().parseFromString(text, "text/html") : doc
}

export async function readEpub(file: File, fallbackTitle: string): Promise<SimpleDoc> {
  const { unzipSync, strFromU8 } = await import("fflate")
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(new Uint8Array(await file.arrayBuffer()))
  } catch {
    throw new Error("This doesn't look like a valid EPUB file.")
  }
  const text = (path: string) => (files[path] ? strFromU8(files[path]) : null)

  // Font obfuscation also uses encryption.xml, so only refuse when content documents are encrypted.
  if (/EncryptedData[\s\S]*?URI="[^"]+\.x?html?"/.test(text("META-INF/encryption.xml") ?? "")) {
    throw new Error("This ebook is DRM-protected and can't be converted.")
  }
  const container = text("META-INF/container.xml")
  const opfPath = container && parseXml(container, "application/xml").querySelector("rootfile")?.getAttribute("full-path")
  const opfText = opfPath && text(opfPath)
  if (!opfPath || !opfText) throw new Error("This EPUB is damaged: its package file is missing.")

  const opf = parseXml(opfText, "application/xml")
  const manifest = new Map<string, string>()
  opf.querySelectorAll("manifest > item").forEach((item) => manifest.set(item.getAttribute("id") ?? "", item.getAttribute("href") ?? ""))
  const title = opf.getElementsByTagName("dc:title")[0]?.textContent?.trim() || fallbackTitle

  const blocks: Block[] = []
  for (const ref of Array.from(opf.querySelectorAll("spine > itemref"))) {
    const href = manifest.get(ref.getAttribute("idref") ?? "")
    if (!href) continue
    const chapterPath = resolvePath(opfPath, href)
    const xhtml = text(chapterPath)
    if (!xhtml) continue
    const doc = parseXml(xhtml, "application/xhtml+xml")
    const body = doc.querySelector("body") ?? doc.documentElement
    const chapter = await readHtmlElement(body, async (src) => {
      const path = resolvePath(chapterPath, src)
      const ext = path.split(".").pop()?.toLowerCase() ?? ""
      return files[path] ? bytesToBlob(files[path], IMAGE_MIME[ext] ?? "application/octet-stream") : null
    })
    if (chapter.length === 0) continue
    if (blocks.length) blocks.push({ type: "pagebreak" })
    blocks.push(...chapter)
  }
  return { title, blocks }
}

function chapterXhtml(title: string, body: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en" xml:lang="en">
<head><meta charset="utf-8"/><title>${escapeXml(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
${body}
</body>
</html>`
}

const STYLE = `body { font-family: serif; line-height: 1.5; margin: 0 5%; }
h1, h2, h3 { font-family: sans-serif; line-height: 1.25; }
p { margin: 0 0 0.8em; }
img { max-width: 100%; height: auto; display: block; margin: 1em auto; }`

export async function writeEpub(doc: SimpleDoc): Promise<Blob> {
  const { zipSync, strToU8 } = await import("fflate")

  // A new chapter starts at each page break, and at each top-level heading.
  const chapters: { title: string; blocks: Block[] }[] = []
  for (const block of doc.blocks) {
    const current = chapters.at(-1)
    const startsChapter = block.type === "pagebreak" || (block.type === "heading" && block.level === 1 && current && current.blocks.length > 0)
    if (!current || startsChapter) chapters.push({ title: "", blocks: [] })
    if (block.type !== "pagebreak") chapters.at(-1)!.blocks.push(block)
  }
  const nonEmpty = chapters.filter((c) => c.blocks.length > 0)
  if (nonEmpty.length === 0) nonEmpty.push({ title: doc.title, blocks: [] })

  const images: { path: string; data: Uint8Array; mime: string }[] = []
  const chapterFiles = nonEmpty.map((chapter, i) => {
    const heading = chapter.blocks.find((b) => b.type === "heading")
    chapter.title = heading?.type === "heading" ? heading.text : nonEmpty.length === 1 ? doc.title : `Chapter ${i + 1}`
    const body = chapter.blocks
      .map((block) => {
        switch (block.type) {
          case "heading":
            return `<h${block.level}>${escapeXml(block.text)}</h${block.level}>`
          case "paragraph":
            return `<p>${block.runs
              .map((r) => {
                let html = escapeXml(r.text).replace(/\n/g, "<br/>")
                if (r.bold) html = `<strong>${html}</strong>`
                if (r.italic) html = `<em>${html}</em>`
                return html
              })
              .join("")}</p>`
          case "image": {
            const path = `images/image-${String(images.length + 1).padStart(3, "0")}.${block.mime === "image/png" ? "png" : "jpg"}`
            images.push({ path, data: block.data, mime: block.mime })
            return `<img src="${path}" alt=""/>`
          }
          default:
            return ""
        }
      })
      .join("\n")
    return { id: `chapter-${String(i + 1).padStart(3, "0")}`, title: chapter.title, xhtml: chapterXhtml(chapter.title, body) }
  })

  const uuid = `urn:uuid:${crypto.randomUUID()}`
  const modified = new Date().toISOString().replace(/\.\d+Z$/, "Z")
  const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="en">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${uuid}</dc:identifier>
    <dc:title>${escapeXml(doc.title)}</dc:title>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="style" href="style.css" media-type="text/css"/>
${chapterFiles.map((c) => `    <item id="${c.id}" href="${c.id}.xhtml" media-type="application/xhtml+xml"/>`).join("\n")}
${images.map((img, i) => `    <item id="img-${i + 1}" href="${img.path}" media-type="${img.mime}"/>`).join("\n")}
  </manifest>
  <spine toc="ncx">
${chapterFiles.map((c) => `    <itemref idref="${c.id}"/>`).join("\n")}
  </spine>
</package>`

  const nav = chapterXhtml(
    "Contents",
    `<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>${chapterFiles.map((c) => `<li><a href="${c.id}.xhtml">${escapeXml(c.title)}</a></li>`).join("")}</ol></nav>`
  )
  // EPUB 2 table of contents, still used by older readers.
  const ncx = `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="${uuid}"/></head>
  <docTitle><text>${escapeXml(doc.title)}</text></docTitle>
  <navMap>${chapterFiles.map((c, i) => `<navPoint id="np-${i + 1}" playOrder="${i + 1}"><navLabel><text>${escapeXml(c.title)}</text></navLabel><content src="${c.id}.xhtml"/></navPoint>`).join("")}</navMap>
</ncx>`

  const entries: Parameters<typeof zipSync>[0] = {
    // Must be the first entry and stored uncompressed, per the EPUB spec.
    mimetype: [strToU8("application/epub+zip"), { level: 0 }],
    "META-INF/container.xml": strToU8(
      `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`
    ),
    "OEBPS/content.opf": strToU8(opf),
    "OEBPS/nav.xhtml": strToU8(nav),
    "OEBPS/toc.ncx": strToU8(ncx),
    "OEBPS/style.css": strToU8(STYLE),
  }
  for (const c of chapterFiles) entries[`OEBPS/${c.id}.xhtml`] = strToU8(c.xhtml)
  for (const img of images) entries[`OEBPS/${img.path}`] = [img.data, { level: 0 }]

  return bytesToBlob(zipSync(entries, { level: 9 }), "application/epub+zip")
}
