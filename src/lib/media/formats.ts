import type { MediaInfo } from "@/lib/media/ffmpeg"

export const MEDIA_ACCEPT = {
  video: "video/*,.mp4,.mov,.webm,.mkv,.avi,.m4v,.3gp,.flv,.wmv,.mpeg,.mpg,.ts",
  audio: "audio/*,.mp3,.wav,.ogg,.oga,.m4a,.aac,.flac,.opus,.wma,.aiff,.amr",
}

export function extOf(name: string) {
  return name.includes(".") ? name.split(".").pop()!.toLowerCase() : "bin"
}

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${String(s).padStart(2, "0")}`
}

export type VideoTarget = "mp4" | "webm" | "mov" | "mkv" | "avi"
export type AudioTarget = "mp3" | "wav" | "ogg" | "m4a" | "flac" | "opus"
export type VideoQuality = "high" | "balanced" | "small"

export const VIDEO_TARGETS: Record<VideoTarget, { label: string; detail: string; mime: string }> = {
  mp4: { label: "MP4", detail: "H.264. Plays everywhere", mime: "video/mp4" },
  webm: { label: "WebM", detail: "VP8 + Vorbis. Made for the web", mime: "video/webm" },
  mov: { label: "MOV", detail: "H.264. Apple QuickTime", mime: "video/quicktime" },
  mkv: { label: "MKV", detail: "Matroska. Holds any codec", mime: "video/x-matroska" },
  avi: { label: "AVI", detail: "MPEG-4. For older players", mime: "video/x-msvideo" },
}

export const AUDIO_TARGETS: Record<AudioTarget, { label: string; detail: string; mime: string; lossless?: boolean }> = {
  mp3: { label: "MP3", detail: "Plays everywhere", mime: "audio/mpeg" },
  m4a: { label: "M4A (AAC)", detail: "Apple devices, small size", mime: "audio/mp4" },
  ogg: { label: "OGG (Vorbis)", detail: "Open format, games and web", mime: "audio/ogg" },
  opus: { label: "Opus", detail: "Best quality per MB", mime: "audio/ogg" },
  wav: { label: "WAV", detail: "Uncompressed, for editing", mime: "audio/wav", lossless: true },
  flac: { label: "FLAC", detail: "Lossless, compressed", mime: "audio/flac", lossless: true },
}

const H264_CRF: Record<VideoQuality, string> = { high: "20", balanced: "23", small: "28" }
const VP8_BITRATE: Record<VideoQuality, string> = { high: "4M", balanced: "2M", small: "800k" }
const MPEG4_Q: Record<VideoQuality, string> = { high: "3", balanced: "5", small: "9" }

/** Scales down to `maxHeight` (never up); H.264 also needs even dimensions. */
function scaleFilter(maxHeight: number | null): string[] {
  return ["-vf", maxHeight ? `scale=-2:'min(${maxHeight},ih)'` : "scale=trunc(iw/2)*2:trunc(ih/2)*2"]
}

/** Codecs each container can take as-is, so we can skip slow re-encoding. */
const COPYABLE: Partial<Record<VideoTarget, { video: string[]; audio: string[] }>> = {
  mp4: { video: ["h264"], audio: ["aac", "mp3"] },
  mov: { video: ["h264", "hevc"], audio: ["aac", "mp3"] },
  webm: { video: ["vp8", "vp9", "av1"], audio: ["opus", "vorbis"] },
}

export function canCopyStreams(target: VideoTarget, info: MediaInfo, maxHeight: number | null): boolean {
  if (maxHeight && info.height && info.height > maxHeight) return false
  if (target === "mkv") return true
  const allowed = COPYABLE[target]
  return (
    !!allowed &&
    !!info.video &&
    allowed.video.includes(info.video) &&
    (!info.audio || allowed.audio.includes(info.audio))
  )
}

export function videoArgs(
  input: string,
  output: string,
  target: VideoTarget,
  quality: VideoQuality,
  maxHeight: number | null,
  copy: boolean
): string[] {
  const faststart = target === "mp4" || target === "mov" ? ["-movflags", "+faststart"] : []
  if (copy) return ["-i", input, "-map", "0:v:0", "-map", "0:a?", "-c", "copy", ...faststart, output]

  const codecs: Record<VideoTarget, string[]> = {
    mp4: ["-c:v", "libx264", "-preset", "veryfast", "-crf", H264_CRF[quality], "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k"],
    mov: ["-c:v", "libx264", "-preset", "veryfast", "-crf", H264_CRF[quality], "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k"],
    mkv: ["-c:v", "libx264", "-preset", "veryfast", "-crf", H264_CRF[quality], "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k"],
    webm: ["-c:v", "libvpx", "-deadline", "realtime", "-cpu-used", "8", "-crf", "10", "-b:v", VP8_BITRATE[quality], "-c:a", "libvorbis", "-b:a", "128k"],
    avi: ["-c:v", "mpeg4", "-q:v", MPEG4_Q[quality], "-c:a", "libmp3lame", "-q:a", "4"],
  }
  return ["-i", input, "-map", "0:v:0", "-map", "0:a?", ...scaleFilter(maxHeight), ...codecs[target], ...faststart, output]
}

export type CompressLevel = "light" | "balanced" | "strong"

const COMPRESS_CRF: Record<CompressLevel, string> = { light: "24", balanced: "28", strong: "32" }

/**
 * Re-encodes to H.264 MP4, the most widely playable result. Without `videoKbps` the quality
 * level decides the size; with it, an average bitrate aims at a file size.
 */
export function compressVideoArgs(
  input: string,
  output: string,
  { level, videoKbps, maxHeight, audioKbps }: { level: CompressLevel; videoKbps: number | null; maxHeight: number | null; audioKbps: number | null }
): string[] {
  const rate = videoKbps
    ? ["-b:v", `${videoKbps}k`, "-maxrate", `${Math.round(videoKbps * 1.5)}k`, "-bufsize", `${videoKbps * 2}k`]
    : ["-crf", COMPRESS_CRF[level]]
  const audio = audioKbps ? ["-map", "0:a?", "-c:a", "aac", "-b:a", `${audioKbps}k`] : ["-an"]
  return [
    "-i", input, "-map", "0:v:0", ...audio, ...scaleFilter(maxHeight),
    "-c:v", "libx264", "-preset", "veryfast", ...rate, "-pix_fmt", "yuv420p", "-movflags", "+faststart", output,
  ]
}

export function audioArgs(input: string, output: string, target: AudioTarget, bitrate: number): string[] {
  const b = `${bitrate}k`
  const codecs: Record<AudioTarget, string[]> = {
    mp3: ["-c:a", "libmp3lame", "-b:a", b],
    m4a: ["-c:a", "aac", "-b:a", b],
    ogg: ["-c:a", "libvorbis", "-b:a", b],
    // libopus in ffmpeg.wasm 0.12 crashes on AAC-decoded audio; the native encoder is stable.
    opus: ["-ar", "48000", "-c:a", "opus", "-strict", "-2", "-b:a", b],
    wav: ["-c:a", "pcm_s16le"],
    flac: ["-c:a", "flac"],
  }
  return ["-i", input, "-vn", "-map", "0:a:0", ...codecs[target], output]
}

/** Two-pass palette gives far better GIF colours than ffmpeg's default. */
const GIF_PALETTE = "split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle"

export function videoToGifArgs(
  input: string,
  output: string,
  { start, duration, fps, width }: { start: number; duration: number; fps: number; width: number | null }
): string[] {
  const scale = width ? `scale='min(${width},iw)':-1:flags=lanczos,` : ""
  return ["-ss", String(start), "-t", String(duration), "-i", input, "-filter_complex", `[0:v]fps=${fps},${scale}${GIF_PALETTE}`, "-loop", "0", output]
}

export type AnimationFormat = "gif" | "apng" | "mp4" | "webm"

export const ANIMATION_TARGETS: Record<AnimationFormat, { label: string; ext: string; mime: string }> = {
  gif: { label: "GIF", ext: "gif", mime: "image/gif" },
  apng: { label: "APNG", ext: "png", mime: "image/apng" },
  mp4: { label: "MP4", ext: "mp4", mime: "video/mp4" },
  webm: { label: "WebM", ext: "webm", mime: "video/webm" },
}

export function animationArgs(input: string, inputFormat: AnimationFormat, output: string, target: AnimationFormat): string[] {
  // .png files are ambiguous (still or animated), so tell ffmpeg to read them as APNG.
  const source = inputFormat === "apng" ? ["-f", "apng", "-i", input] : ["-i", input]
  switch (target) {
    case "gif":
      return [...source, "-filter_complex", GIF_PALETTE, "-loop", "0", output]
    case "apng":
      return [...source, "-plays", "0", "-f", "apng", output]
    case "mp4":
      return [...source, "-movflags", "+faststart", ...scaleFilter(null), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", output]
    case "webm":
      return [...source, "-c:v", "libvpx", "-deadline", "realtime", "-cpu-used", "8", "-crf", "10", "-b:v", "2M", "-auto-alt-ref", "0", output]
  }
}

export function framesToGifArgs(pattern: string, output: string, delayMs: number): string[] {
  return ["-framerate", `1000/${delayMs}`, "-i", pattern, "-filter_complex", GIF_PALETTE, "-loop", "0", output]
}
