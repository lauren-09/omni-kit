declare module "imagetracerjs" {
  const ImageTracer: {
    imagedataToSVG(imageData: ImageData, options?: Record<string, number | string>): string
  }
  export default ImageTracer
}
