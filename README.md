# OmniKit

Free, private file tools that run entirely in the browser. No accounts, no ads, no tracking, no uploads.

## Tools

| Category | Main tools | Quick conversions |
| --- | --- | --- |
| **Image** | Image Converter, Compress, Resize, Remove Background (AI), PNG to SVG, SVG Converter | WEBP→PNG, WEBP→JPG, JFIF→PNG, HEIC→JPG, HEIC→PNG, JPG→PNG, PNG→JPG |
| **PDF & Documents** | PDF Converter, Document Converter, Ebook Converter, Word→PDF, PDF→Word, Merge, Split, Compress, Images→PDF, PDF→Images | PDF→JPG, PDF→EPUB, EPUB→PDF, DOCX→PDF, HEIC→PDF, JPG→PDF |
| **Video & Audio** | Video Converter, Audio Converter, MP3 Converter, MP4 Converter | MP4→MP3, Video→MP3, MOV→MP4, WEBM→MP4, MP3→OGG, WAV→MP3, M4A→MP3 |
| **GIF** | Video→GIF, Image→GIF, GIF Converter | MP4→GIF, WEBM→GIF, MOV→GIF, AVI→GIF, APNG→GIF, GIF→MP4, GIF→APNG |
| **Archive** | Zip Files, Unzip Files | |

## How it works

OmniKit is a static site. Every tool processes files on the visitor's own device with JavaScript and WebAssembly, so there's no server to pay for and files never leave the browser.

The ~50 tools are entries in [`src/tools/registry.ts`](src/tools/registry.ts) that point at a handful of **engines** with preset options. "MP4 to MP3" is the media engine with `accept: .mp4` and `defaultTarget: "mp3"`. Adding a new "X to Y" page is usually a few lines in the registry.

| Engine | Library |
| --- | --- |
| Images (convert, compress, resize, ICO) | Canvas API + `heic-to` (libheif) for iPhone HEIC photos |
| PNG → SVG | `imagetracerjs`, run in a Web Worker |
| Background removal | `@imgly/background-removal` (ONNX model running in the browser) |
| Documents and ebooks | Every format is read into a small shared model (`src/lib/documents/model.ts`) and written back out. Readers: `pdfjs-dist`, `mammoth` (DOCX), a built-in EPUB reader, `marked` (Markdown). Writers: `pdfmake` (PDF with real text), `docx`, a built-in EPUB 3 writer, HTML, TXT |
| Word → PDF (exact layout) | `docx-preview` + `html2canvas-pro` + `jspdf` |
| PDF tools | `pdf-lib` + `pdfjs-dist` |
| Video, audio, GIF | `ffmpeg.wasm` (FFmpeg compiled to WebAssembly) |
| Zip / unzip | `fflate` |

Every engine is lazy-loaded, so the first visit downloads only ~100 KB (gzipped).

### Network requests besides the site itself

Two large engines download the first time someone uses them, then stay in the browser cache. No user files are ever sent.

- **Remove Background:** AI model (~40–80 MB) from IMG.LY's CDN (`staticimgly.com`).
- **Video, audio and GIF tools:** FFmpeg engine (~32 MB) from jsDelivr (`cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10`). It isn't bundled because it's over Cloudflare Pages' 25 MiB per-file limit.

## Run locally

Requires Node.js 20.19 or newer.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build in dist/
npm run preview   # serve the production build
```

## Deploy for free

The build output (`dist/`, about 11 MB) is plain static files with hash-based routing (`#/merge-pdf`, `#/c/gif`), so it works on any static host with no rewrite rules.

### Recommended: Cloudflare Pages

Unlimited bandwidth on the free plan, and it supports custom headers, needed if you later enable multi-threaded video conversion.

1. In the Cloudflare dashboard go to **Workers & Pages → Create → Pages → Connect to Git** and pick this repository.
2. Framework preset: **Vite**. Build command: `npm run build`. Output directory: `dist`.
3. Deploy. Every push to `main` redeploys automatically, and the site is live at `https://<project>.pages.dev`.

### Alternative: Netlify (drag and drop, no Git needed)

Run `npm run build`, then drag the `dist` folder onto <https://app.netlify.com/drop>.

## Known limitations

- **Video** runs on the visitor's CPU (single-threaded WebAssembly), so it's slower than desktop apps: roughly real time for HD. Files over ~1 GB may not fit in browser memory. MP4/MOV files that are already H.264 + AAC are re-packaged instantly without re-encoding.
- **Document conversions** keep text, headings, bold/italic, lists and images. Tables and multi-column layouts are flattened. Scanned PDFs contain no text (no OCR). PDF output uses the bundled Roboto font, which doesn't cover Chinese, Japanese or Korean.
- **Ebooks:** EPUB only (Kindle accepts EPUB through Send to Kindle). DRM-protected books can't be converted.
- **Word → PDF** supports `.docx` only (not legacy `.doc`). "Convert to PDF" stores pages as images. Use "Print to PDF" or the Document Converter for selectable text.
- **Compress PDF** re-renders pages as images, which suits scans. Text-only PDFs usually can't be made smaller this way, and the tool then keeps the original.
- **PNG → SVG** traces colour regions. It works well for logos and icons, but photos become stylized.
- The **Opus** encoder from ffmpeg.wasm's libopus crashes on AAC-sourced audio, so OmniKit uses FFmpeg's native Opus encoder, and WebM video uses Vorbis audio.

## Licenses

OmniKit's own code can be under any license you choose, but some dependencies are copyleft. If you host it publicly, keep the source code public (for example, a public GitHub repo):

| Dependency | License |
| --- | --- |
| `@imgly/background-removal` | AGPL-3.0 |
| `@ffmpeg/core` (loaded at runtime; includes x264) | GPL-2.0-or-later |
| `heic-to` (libheif) | LGPL-3.0 |
| Everything else | MIT / BSD / Apache-2.0 / Unlicense |
