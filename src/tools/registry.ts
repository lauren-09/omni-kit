import { createElement, lazy, type ComponentProps, type ComponentType, type LazyExoticComponent, type ReactNode } from "react"
import {
  AudioLines,
  BookOpen,
  Clapperboard,
  Combine,
  FileArchive,
  FileAudio,
  FileDown,
  FileImage,
  FileOutput,
  Files,
  FileText,
  FileType,
  FileVideo,
  Film,
  Image,
  ImageDown,
  ImagePlay,
  Images,
  Music,
  PackageOpen,
  PenTool,
  Repeat2,
  Scaling,
  Scissors,
  Shapes,
  Shrink,
  WandSparkles,
  type LucideIcon,
} from "lucide-react"
import { MEDIA_ACCEPT } from "@/lib/media/formats"

export type CategoryId = "image" | "document" | "media" | "gif" | "archive"

export type Category = { id: CategoryId; name: string; description: string; icon: LucideIcon; accent: string }

export const CATEGORIES: Category[] = [
  {
    id: "image",
    name: "Image",
    description: "Convert, compress, resize and edit photos and graphics.",
    icon: Image,
    accent: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  {
    id: "document",
    name: "PDF & Documents",
    description: "Convert documents and ebooks, and merge, split or shrink PDFs.",
    icon: FileText,
    accent: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  {
    id: "media",
    name: "Video & Audio",
    description: "Convert video and audio, or pull the sound out of a video.",
    icon: Clapperboard,
    accent: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  {
    id: "gif",
    name: "GIF",
    description: "Make animated GIFs from videos and images, or convert them.",
    icon: ImagePlay,
    accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    id: "archive",
    name: "Archive",
    description: "Bundle files and folders into a ZIP, or open one.",
    icon: FileArchive,
    accent: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
]

export type Tool = {
  /** Also the URL: #/compress-image */
  id: string
  name: string
  description: string
  category: CategoryId
  icon: LucideIcon
  /** Extra words for search. */
  keywords: string
  /** Main tools get a card; the rest are shown as quick conversion links. */
  featured?: boolean
  badge?: string
  render: () => ReactNode
}

type ToolInfo = Omit<Tool, "render">

// One lazy chunk per engine; heavy libraries load only when a tool using them opens.
const engines = {
  imageCompress: lazy(() => import("./image-compress")),
  imageResize: lazy(() => import("./image-resize")),
  imageConvert: lazy(() => import("./image-convert")),
  imageTrace: lazy(() => import("./image-trace")),
  backgroundRemove: lazy(() => import("./background-remove")),
  documentConvert: lazy(() => import("./document-convert")),
  wordToPdf: lazy(() => import("./word-to-pdf")),
  pdfToWord: lazy(() => import("./pdf-to-word")),
  pdfMerge: lazy(() => import("./pdf-merge")),
  pdfSplit: lazy(() => import("./pdf-split")),
  pdfCompress: lazy(() => import("./pdf-compress")),
  imagesToPdf: lazy(() => import("./images-to-pdf")),
  pdfToImages: lazy(() => import("./pdf-to-images")),
  mediaConvert: lazy(() => import("./media-convert")),
  videoCompress: lazy(() => import("./video-compress")),
  videoToGif: lazy(() => import("./video-to-gif")),
  animationConvert: lazy(() => import("./animation-convert")),
  imagesToGif: lazy(() => import("./images-to-gif")),
  zipFiles: lazy(() => import("./zip-files")),
  unzip: lazy(() => import("./unzip")),
}

/** Pairs tool metadata with an engine and type-checked preset props. */
function tool<C extends ComponentType<any>>(info: ToolInfo, engine: LazyExoticComponent<C>, props?: ComponentProps<C>): Tool {
  return { ...info, render: () => createElement(engine, props) }
}

const IMAGE = { category: "image" } as const
const DOC = { category: "document" } as const
const MEDIA = { category: "media" } as const
const GIF = { category: "gif" } as const

const ALL_DOCS = ["pdf", "docx", "epub", "txt", "md", "html"] as const

export const TOOLS: Tool[] = [
  // ---------------- Image ----------------
  tool(
    { ...IMAGE, id: "image-converter", name: "Image Converter", featured: true, icon: Repeat2,
      description: "Convert between JPG, PNG, WebP and ICO, including HEIC, JFIF and SVG files.",
      keywords: "convert format jpg jpeg png webp heic jfif svg avif gif bmp ico favicon" },
    engines.imageConvert
  ),
  tool(
    { ...IMAGE, id: "compress-image", name: "Compress Image", featured: true, icon: ImageDown,
      description: "Reduce JPG, PNG and WebP file sizes in bulk without visible quality loss.",
      keywords: "reduce reducer shrink optimize smaller size kb mb photo jpg jpeg png webp heic" },
    engines.imageCompress
  ),
  tool(
    { ...IMAGE, id: "resize-image", name: "Resize Image", featured: true, icon: Scaling,
      description: "Change image dimensions by percentage or exact pixels.",
      keywords: "scale dimensions width height pixels smaller bigger photo" },
    engines.imageResize
  ),
  tool(
    { ...IMAGE, id: "remove-background", name: "Remove Background", featured: true, icon: WandSparkles, badge: "AI",
      description: "Cut out people, products and pets with on-device AI. Get a transparent PNG.",
      keywords: "background remover bg erase transparent cutout ai photo" },
    engines.backgroundRemove
  ),
  tool(
    { ...IMAGE, id: "png-to-svg", name: "PNG to SVG", featured: true, icon: PenTool,
      description: "Trace logos and icons into scalable vector graphics.",
      keywords: "vectorize vector trace svg png jpg logo icon convert" },
    engines.imageTrace
  ),
  tool(
    { ...IMAGE, id: "svg-converter", name: "SVG Converter", featured: true, icon: Shapes,
      description: "Turn SVG graphics into sharp PNG, JPG, WebP or ICO at any size.",
      keywords: "svg to png svg to jpg rasterize vector export" },
    engines.imageConvert,
    { accept: ".svg,image/svg+xml", hint: "SVG files", defaultTarget: "image/png" }
  ),
  tool(
    { ...IMAGE, id: "webp-to-png", name: "WEBP to PNG", icon: Repeat2, description: "Convert WebP images to PNG.", keywords: "webp png convert" },
    engines.imageConvert,
    { accept: ".webp,image/webp", hint: "WebP images", defaultTarget: "image/png" }
  ),
  tool(
    { ...IMAGE, id: "webp-to-jpg", name: "WEBP to JPG", icon: Repeat2, description: "Convert WebP images to JPG.", keywords: "webp jpg jpeg convert" },
    engines.imageConvert,
    { accept: ".webp,image/webp", hint: "WebP images", defaultTarget: "image/jpeg" }
  ),
  tool(
    { ...IMAGE, id: "jfif-to-png", name: "JFIF to PNG", icon: Repeat2, description: "Convert JFIF images to PNG.", keywords: "jfif png jpg convert" },
    engines.imageConvert,
    { accept: ".jfif,.jpg,.jpeg,image/jpeg", hint: "JFIF images", defaultTarget: "image/png" }
  ),
  tool(
    { ...IMAGE, id: "heic-to-jpg", name: "HEIC to JPG", icon: Repeat2, description: "Convert iPhone HEIC photos to JPG.", keywords: "heic heif iphone apple jpg jpeg convert" },
    engines.imageConvert,
    { accept: ".heic,.heif,image/heic,image/heif", hint: "HEIC / HEIF photos", defaultTarget: "image/jpeg" }
  ),
  tool(
    { ...IMAGE, id: "heic-to-png", name: "HEIC to PNG", icon: Repeat2, description: "Convert iPhone HEIC photos to PNG.", keywords: "heic heif iphone apple png convert" },
    engines.imageConvert,
    { accept: ".heic,.heif,image/heic,image/heif", hint: "HEIC / HEIF photos", defaultTarget: "image/png" }
  ),
  tool(
    { ...IMAGE, id: "jpg-to-png", name: "JPG to PNG", icon: Repeat2, description: "Convert JPG photos to PNG.", keywords: "jpg jpeg png convert" },
    engines.imageConvert,
    { accept: ".jpg,.jpeg,.jfif,image/jpeg", hint: "JPG images", defaultTarget: "image/png" }
  ),
  tool(
    { ...IMAGE, id: "png-to-jpg", name: "PNG to JPG", icon: Repeat2, description: "Convert PNG images to JPG.", keywords: "png jpg jpeg convert" },
    engines.imageConvert,
    { accept: ".png,image/png", hint: "PNG images", defaultTarget: "image/jpeg" }
  ),

  // ---------------- PDF & Documents ----------------
  tool(
    { ...DOC, id: "pdf-converter", name: "PDF Converter", featured: true, icon: FileOutput,
      description: "Convert PDFs to Word, EPUB, text, HTML, JPG or PNG.",
      keywords: "pdf convert word docx epub txt html jpg png" },
    engines.documentConvert,
    { inputs: ["pdf"], outputs: ["docx", "epub", "txt", "html", "jpg", "png"], defaultOutput: "docx", hint: "PDF files" }
  ),
  tool(
    { ...DOC, id: "document-converter", name: "Document Converter", featured: true, icon: Files,
      description: "Convert between PDF, Word, EPUB, HTML, Markdown and plain text.",
      keywords: "document convert docx word pdf epub txt text markdown md html" },
    engines.documentConvert,
    { inputs: [...ALL_DOCS], outputs: ["pdf", "docx", "epub", "html", "txt"], defaultOutput: "pdf", hint: "DOCX, PDF, EPUB, HTML, Markdown, TXT" }
  ),
  tool(
    { ...DOC, id: "ebook-converter", name: "Ebook Converter", featured: true, icon: BookOpen,
      description: "Turn documents into EPUB ebooks for Kindle, Apple Books and Kobo, or convert ebooks back.",
      keywords: "ebook epub kindle kobo apple books convert pdf docx" },
    engines.documentConvert,
    { inputs: [...ALL_DOCS], outputs: ["epub", "pdf", "docx", "txt", "html"], defaultOutput: "epub", hint: "EPUB, PDF, DOCX, HTML, Markdown, TXT" }
  ),
  tool(
    { ...DOC, id: "word-to-pdf", name: "Word to PDF", featured: true, icon: FileText,
      description: "Turn .docx documents into PDFs that look like the original.",
      keywords: "docx doc word to pdf convert microsoft office" },
    engines.wordToPdf
  ),
  tool(
    { ...DOC, id: "pdf-to-word", name: "PDF to Word", featured: true, icon: FileType,
      description: "Convert PDFs into editable Word (.docx) documents.",
      keywords: "pdf to docx word convert edit editable office" },
    engines.pdfToWord
  ),
  tool(
    { ...DOC, id: "merge-pdf", name: "Merge PDF", featured: true, icon: Combine,
      description: "Combine several PDFs into one, in any order you like.",
      keywords: "combine join append pdf" },
    engines.pdfMerge
  ),
  tool(
    { ...DOC, id: "split-pdf", name: "Split PDF", featured: true, icon: Scissors,
      description: "Extract pages or split a PDF into separate files.",
      keywords: "extract pages separate cut remove pdf" },
    engines.pdfSplit
  ),
  tool(
    { ...DOC, id: "compress-pdf", name: "Compress PDF", featured: true, icon: FileDown,
      description: "Make large, scanned or image-heavy PDFs much smaller.",
      keywords: "reduce shrink pdf size smaller optimize scan" },
    engines.pdfCompress
  ),
  tool(
    { ...DOC, id: "images-to-pdf", name: "Images to PDF", featured: true, icon: Images,
      description: "Turn photos or scans (JPG, PNG, HEIC) into a single PDF.",
      keywords: "jpg to pdf png to pdf heic photo picture scan convert" },
    engines.imagesToPdf
  ),
  tool(
    { ...DOC, id: "pdf-to-images", name: "PDF to Images", featured: true, icon: FileImage,
      description: "Save every PDF page as a high-quality PNG or JPG.",
      keywords: "pdf to jpg pdf to png pages export picture" },
    engines.pdfToImages
  ),
  tool(
    { ...DOC, id: "pdf-to-jpg", name: "PDF to JPG", icon: FileImage, description: "Save every page of a PDF as a JPG image.", keywords: "pdf jpg jpeg image pages" },
    engines.pdfToImages,
    { defaultFormat: "image/jpeg" }
  ),
  tool(
    { ...DOC, id: "pdf-to-epub", name: "PDF to EPUB", icon: BookOpen, description: "Turn a PDF into a reflowable EPUB ebook.", keywords: "pdf epub ebook kindle" },
    engines.documentConvert,
    { inputs: ["pdf"], outputs: ["epub"], defaultOutput: "epub", hint: "PDF files" }
  ),
  tool(
    { ...DOC, id: "epub-to-pdf", name: "EPUB to PDF", icon: BookOpen, description: "Convert EPUB ebooks into PDF documents.", keywords: "epub pdf ebook print" },
    engines.documentConvert,
    { inputs: ["epub"], outputs: ["pdf"], defaultOutput: "pdf", hint: "EPUB ebooks (without DRM)" }
  ),
  tool(
    { ...DOC, id: "docx-to-pdf", name: "DOCX to PDF", icon: FileText, description: "Convert Word .docx files to PDF.", keywords: "docx word pdf" },
    engines.wordToPdf
  ),
  tool(
    { ...DOC, id: "heic-to-pdf", name: "HEIC to PDF", icon: Images, description: "Combine iPhone HEIC photos into a PDF.", keywords: "heic heif iphone pdf" },
    engines.imagesToPdf,
    { accept: ".heic,.heif,image/heic,image/heif", hint: "HEIC / HEIF photos · one page each" }
  ),
  tool(
    { ...DOC, id: "jpg-to-pdf", name: "JPG to PDF", icon: Images, description: "Combine JPG images into a PDF.", keywords: "jpg jpeg pdf photo scan" },
    engines.imagesToPdf,
    { accept: ".jpg,.jpeg,.jfif,image/jpeg", hint: "JPG images · one page each" }
  ),

  // ---------------- Video & Audio ----------------
  tool(
    { ...MEDIA, id: "video-converter", name: "Video Converter", featured: true, icon: FileVideo,
      description: "Convert videos between MP4, WebM, MOV, MKV and AVI, and shrink them.",
      keywords: "video convert mp4 webm mov mkv avi resize compress" },
    engines.mediaConvert,
    { kind: "video", accept: MEDIA_ACCEPT.video, hint: "MP4, MOV, WebM, MKV, AVI and more", defaultTarget: "mp4" }
  ),
  tool(
    { ...MEDIA, id: "compress-video", name: "Compress Video", featured: true, icon: Shrink,
      description: "Shrink videos by quality level or to a target size, like 10 MB or 25 MB.",
      keywords: "video compressor reduce shrink smaller size mb mp4 mov webm discord email whatsapp" },
    engines.videoCompress
  ),
  tool(
    { ...MEDIA, id: "audio-converter", name: "Audio Converter", featured: true, icon: AudioLines,
      description: "Convert between MP3, WAV, M4A, OGG, FLAC and Opus, or extract audio from video.",
      keywords: "audio convert mp3 wav m4a aac ogg flac opus sound music" },
    engines.mediaConvert,
    { kind: "audio", accept: `${MEDIA_ACCEPT.audio},${MEDIA_ACCEPT.video}`, hint: "Any audio or video file", defaultTarget: "mp3" }
  ),
  tool(
    { ...MEDIA, id: "mp3-converter", name: "MP3 Converter", featured: true, icon: Music,
      description: "Turn any audio or video file into an MP3.",
      keywords: "mp3 convert audio music sound extract" },
    engines.mediaConvert,
    { kind: "audio", accept: `${MEDIA_ACCEPT.audio},${MEDIA_ACCEPT.video}`, hint: "Any audio or video file", defaultTarget: "mp3" }
  ),
  tool(
    { ...MEDIA, id: "mp4-converter", name: "MP4 Converter", featured: true, icon: Clapperboard,
      description: "Convert any video to MP4, the format that plays everywhere.",
      keywords: "mp4 convert video h264" },
    engines.mediaConvert,
    { kind: "video", accept: MEDIA_ACCEPT.video, hint: "MOV, WebM, MKV, AVI and more", defaultTarget: "mp4" }
  ),
  tool(
    { ...MEDIA, id: "mp4-to-mp3", name: "MP4 to MP3", icon: FileAudio, description: "Extract the audio track of an MP4 as MP3.", keywords: "mp4 mp3 extract audio" },
    engines.mediaConvert,
    { kind: "audio", accept: ".mp4,.m4v,video/mp4", hint: "MP4 videos", defaultTarget: "mp3" }
  ),
  tool(
    { ...MEDIA, id: "video-to-mp3", name: "Video to MP3", icon: FileAudio, description: "Extract the audio from any video as MP3.", keywords: "video mp3 extract audio sound" },
    engines.mediaConvert,
    { kind: "audio", accept: MEDIA_ACCEPT.video, hint: "Any video", defaultTarget: "mp3" }
  ),
  tool(
    { ...MEDIA, id: "mov-to-mp4", name: "MOV to MP4", icon: FileVideo, description: "Convert iPhone and QuickTime MOV videos to MP4.", keywords: "mov mp4 iphone quicktime" },
    engines.mediaConvert,
    { kind: "video", accept: ".mov,video/quicktime", hint: "MOV videos", defaultTarget: "mp4" }
  ),
  tool(
    { ...MEDIA, id: "webm-to-mp4", name: "WEBM to MP4", icon: FileVideo, description: "Convert WebM videos to MP4.", keywords: "webm mp4" },
    engines.mediaConvert,
    { kind: "video", accept: ".webm,video/webm", hint: "WebM videos", defaultTarget: "mp4" }
  ),
  tool(
    { ...MEDIA, id: "mp3-to-ogg", name: "MP3 to OGG", icon: FileAudio, description: "Convert MP3 audio to OGG Vorbis.", keywords: "mp3 ogg vorbis" },
    engines.mediaConvert,
    { kind: "audio", accept: ".mp3,audio/mpeg", hint: "MP3 files", defaultTarget: "ogg" }
  ),
  tool(
    { ...MEDIA, id: "wav-to-mp3", name: "WAV to MP3", icon: FileAudio, description: "Shrink WAV recordings into MP3.", keywords: "wav mp3 compress" },
    engines.mediaConvert,
    { kind: "audio", accept: ".wav,audio/wav,audio/x-wav", hint: "WAV files", defaultTarget: "mp3" }
  ),
  tool(
    { ...MEDIA, id: "m4a-to-mp3", name: "M4A to MP3", icon: FileAudio, description: "Convert M4A / AAC audio to MP3.", keywords: "m4a aac mp3 voice memo" },
    engines.mediaConvert,
    { kind: "audio", accept: ".m4a,.aac,audio/mp4,audio/aac", hint: "M4A / AAC files", defaultTarget: "mp3" }
  ),

  // ---------------- GIF ----------------
  tool(
    { ...GIF, id: "video-to-gif", name: "Video to GIF", featured: true, icon: Film,
      description: "Turn a clip from any video into a high-quality animated GIF.",
      keywords: "video gif animated clip mp4 webm mov avi mkv" },
    engines.videoToGif
  ),
  tool(
    { ...GIF, id: "image-to-gif", name: "Image to GIF", featured: true, icon: ImagePlay,
      description: "Combine images into an animated GIF slideshow.",
      keywords: "images photos gif animated slideshow frames" },
    engines.imagesToGif
  ),
  tool(
    { ...GIF, id: "gif-converter", name: "GIF Converter", featured: true, icon: Repeat2,
      description: "Convert animated GIFs to MP4, WebM or APNG, and APNG to GIF.",
      keywords: "gif apng mp4 webm animated convert" },
    engines.animationConvert,
    { defaultTarget: "mp4" }
  ),
  tool(
    { ...GIF, id: "mp4-to-gif", name: "MP4 to GIF", icon: Film, description: "Turn an MP4 clip into a GIF.", keywords: "mp4 gif" },
    engines.videoToGif,
    { accept: ".mp4,.m4v,video/mp4", hint: "MP4 video" }
  ),
  tool(
    { ...GIF, id: "webm-to-gif", name: "WEBM to GIF", icon: Film, description: "Turn a WebM clip into a GIF.", keywords: "webm gif" },
    engines.videoToGif,
    { accept: ".webm,video/webm", hint: "WebM video" }
  ),
  tool(
    { ...GIF, id: "mov-to-gif", name: "MOV to GIF", icon: Film, description: "Turn an iPhone or QuickTime MOV into a GIF.", keywords: "mov gif iphone" },
    engines.videoToGif,
    { accept: ".mov,video/quicktime", hint: "MOV video" }
  ),
  tool(
    { ...GIF, id: "avi-to-gif", name: "AVI to GIF", icon: Film, description: "Turn an AVI clip into a GIF.", keywords: "avi gif" },
    engines.videoToGif,
    { accept: ".avi,video/x-msvideo,video/avi", hint: "AVI video" }
  ),
  tool(
    { ...GIF, id: "apng-to-gif", name: "APNG to GIF", icon: Repeat2, description: "Convert animated PNGs to GIF.", keywords: "apng png gif animated" },
    engines.animationConvert,
    { accept: ".png,.apng", hint: "Animated PNG", defaultTarget: "gif" }
  ),
  tool(
    { ...GIF, id: "gif-to-mp4", name: "GIF to MP4", icon: Repeat2, description: "Convert GIFs to MP4 videos, often 10× smaller.", keywords: "gif mp4 video" },
    engines.animationConvert,
    { accept: ".gif,image/gif", hint: "Animated GIF", defaultTarget: "mp4" }
  ),
  tool(
    { ...GIF, id: "gif-to-apng", name: "GIF to APNG", icon: Repeat2, description: "Convert GIFs to animated PNG with full colour.", keywords: "gif apng png" },
    engines.animationConvert,
    { accept: ".gif,image/gif", hint: "Animated GIF", defaultTarget: "apng" }
  ),

  // ---------------- Archive ----------------
  tool(
    { category: "archive", id: "zip-files", name: "Zip Files", featured: true, icon: FileArchive,
      description: "Compress files or whole folders into a single ZIP archive.",
      keywords: "zip compress compressor archive folder bundle reduce" },
    engines.zipFiles
  ),
  tool(
    { category: "archive", id: "unzip", name: "Unzip Files", featured: true, icon: PackageOpen,
      description: "Open ZIP archives and download what's inside.",
      keywords: "extract unzip decompress open archive" },
    engines.unzip
  ),
]

export function categoryOf(tool: Tool): Category {
  return CATEGORIES.find((c) => c.id === tool.category)!
}

export function toolsIn(category: CategoryId): Tool[] {
  return TOOLS.filter((t) => t.category === category)
}

export function searchTools(query: string): Tool[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return TOOLS
  return TOOLS.filter((tool) => {
    const haystack = `${tool.name} ${tool.description} ${tool.keywords}`.toLowerCase()
    return terms.every((term) => haystack.includes(term))
  })
}
