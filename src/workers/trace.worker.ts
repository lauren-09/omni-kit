import ImageTracer from "imagetracerjs"

// Tracing is CPU-heavy, so it runs here instead of freezing the page.
self.onmessage = (event: MessageEvent<{ imageData: ImageData; options: Record<string, number> }>) => {
  try {
    self.postMessage({ svg: ImageTracer.imagedataToSVG(event.data.imageData, event.data.options) })
  } catch (err) {
    self.postMessage({ error: err instanceof Error ? err.message : String(err) })
  }
}
