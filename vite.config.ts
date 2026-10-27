import path from "node:path"
import { defineConfig, type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

/**
 * onnxruntime-web references its 24 MB WebAssembly file, so Vite copies it into dist/.
 * @imgly/background-removal never requests that copy: it loads the runtime from IMG.LY's CDN.
 */
function dropUnusedOnnxWasm(): Plugin {
  return {
    name: "drop-unused-onnx-wasm",
    apply: "build",
    generateBundle(_, bundle) {
      for (const file of Object.keys(bundle)) {
        if (/ort-wasm[^/]*\.wasm$/.test(file)) delete bundle[file]
      }
    },
  }
}

export default defineConfig({
  // Relative base so the build works on any host or sub-path.
  base: "./",
  plugins: [react(), tailwindcss(), dropUnusedOnnxWasm()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  build: {
    // Large chunks (pdf.js, HEIC decoder, pdfmake fonts, ONNX runtime) are lazy-loaded per tool, never on first visit.
    chunkSizeWarningLimit: 3500,
  },
  optimizeDeps: {
    // These ship their own workers/WASM loaders; pre-bundling breaks them.
    exclude: ["@imgly/background-removal", "@ffmpeg/ffmpeg"],
  },
})
