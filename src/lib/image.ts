export type ImageFormat = "image/jpeg" | "image/png" | "image/webp"

export const FORMAT_EXT: Record<ImageFormat, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

export const FORMAT_LABEL: Record<ImageFormat, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WebP",
}

/** File-picker filter for every image type the tools can read. HEIC and JFIF need explicit extensions on Windows. */
export const IMAGE_ACCEPT = "image/*,.heic,.heif,.jfif,.avif,.svg"

export function isHeic(file: Blob): boolean {
  return /image\/hei[cf]/.test(file.type) || /\.(heic|heif)$/i.test((file as File).name ?? "")
}

/** Maps any input type to a format the canvas can encode: HEIC photos become JPG, others PNG. */
export function encodableFormat(file: Blob): ImageFormat {
  if (file.type in FORMAT_EXT) return file.type as ImageFormat
  return isHeic(file) ? "image/jpeg" : "image/png"
}

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void }

export async function decodeImage(blob: Blob): Promise<Decoded> {
  if (isHeic(blob)) {
    // Only Safari decodes HEIC natively, so use libheif (WebAssembly) everywhere.
    const { heicTo } = await import("heic-to")
    try {
      const bitmap = await heicTo({ blob, type: "bitmap" })
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
    } catch {
      throw new Error("Couldn't read this HEIC photo. The file may be damaged.")
    }
  }
  try {
    // Respects EXIF orientation, so phone photos come out upright.
    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" })
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
  } catch {
    // SVG and a few other formats only decode through an <img> element.
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.src = url
    try {
      await img.decode()
    } catch {
      URL.revokeObjectURL(url)
      throw new Error("Your browser can't read this image format.")
    }
    return {
      source: img,
      width: img.naturalWidth || 1024,
      height: img.naturalHeight || 1024,
      close: () => URL.revokeObjectURL(url),
    }
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode image."))), type, quality)
  )
}

export function fitWithin(width: number, height: number, maxWidth: number, maxHeight: number) {
  const scale = Math.min(1, maxWidth / width, maxHeight / height)
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export type EncodeOptions = {
  type: ImageFormat
  /** 0–1, ignored for PNG. */
  quality?: number
  /** Fill colour behind transparent pixels. JPG always gets one (white by default). */
  background?: string
  resize?: (width: number, height: number) => { width: number; height: number }
}

export async function encodeImage(blob: Blob, options: EncodeOptions): Promise<Blob> {
  const image = await decodeImage(blob)
  try {
    const { width, height } = options.resize?.(image.width, image.height) ?? image
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")!
    ctx.imageSmoothingQuality = "high"
    if (options.background || options.type === "image/jpeg") {
      ctx.fillStyle = options.background ?? "#ffffff"
      ctx.fillRect(0, 0, width, height)
    }
    ctx.drawImage(image.source, 0, 0, width, height)
    return await canvasToBlob(canvas, options.type, options.quality)
  } finally {
    image.close()
  }
}

/** Builds a multi-size .ico (PNG-compressed entries, supported since Windows Vista). */
export async function encodeIco(blob: Blob, sizes = [16, 32, 48, 64, 128, 256]): Promise<Blob> {
  const image = await decodeImage(blob)
  let pngs: Uint8Array[]
  try {
    pngs = await Promise.all(
      sizes.map(async (size) => {
        const canvas = document.createElement("canvas")
        canvas.width = canvas.height = size
        const ctx = canvas.getContext("2d")!
        ctx.imageSmoothingQuality = "high"
        // Letterbox non-square images instead of stretching them.
        const { width, height } = fitWithin(image.width, image.height, size, size)
        ctx.drawImage(image.source, (size - width) / 2, (size - height) / 2, width, height)
        return new Uint8Array(await (await canvasToBlob(canvas, "image/png")).arrayBuffer())
      })
    )
  } finally {
    image.close()
  }

  const header = new DataView(new ArrayBuffer(6 + 16 * sizes.length))
  header.setUint16(2, 1, true) // type: icon
  header.setUint16(4, sizes.length, true)
  let offset = header.byteLength
  sizes.forEach((size, i) => {
    const entry = 6 + 16 * i
    header.setUint8(entry, size >= 256 ? 0 : size) // 0 means 256
    header.setUint8(entry + 1, size >= 256 ? 0 : size)
    header.setUint16(entry + 4, 1, true) // colour planes
    header.setUint16(entry + 6, 32, true) // bits per pixel
    header.setUint32(entry + 8, pngs[i].byteLength, true)
    header.setUint32(entry + 12, offset, true)
    offset += pngs[i].byteLength
  })
  return new Blob([header.buffer, ...(pngs as Uint8Array<ArrayBuffer>[])], { type: "image/x-icon" })
}
