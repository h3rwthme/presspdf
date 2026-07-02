import * as pdfjsLib from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.js?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

export async function openPdf(buf) {
  return pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise
}

// Render satu halaman ke canvas baru pada skala tertentu
export async function renderPage(page, scale) {
  const vp = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(vp.width)
  canvas.height = Math.ceil(vp.height)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport: vp }).promise
  return canvas
}

export const canvasToJpeg = (canvas, quality) =>
  new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality))
