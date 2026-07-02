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

// Extract embedded raster images with their placement (PDF points).
// Walks the operator list tracking the transform matrix, so each image knows
// where and how large it appears on the page. -> [{ bytes(png), w, h, x, top }]
export async function extractImages(page, { maxPerPage = 15, minSize = 24 } = {}) {
  const OPS = pdfjsLib.OPS
  let opList
  try { opList = await page.getOperatorList() } catch { return [] }
  const { fnArray, argsArray } = opList

  const mul = (m, n) => [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ]
  const stack = []
  let ctm = [1, 0, 0, 1, 0, 0]
  const found = []

  for (let i = 0; i < fnArray.length && found.length < maxPerPage; i++) {
    const fn = fnArray[i], args = argsArray[i]
    if (fn === OPS.save) stack.push(ctm)
    else if (fn === OPS.restore) ctm = stack.pop() || ctm
    else if (fn === OPS.transform) ctm = mul(ctm, args)
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
      let obj = null
      if (fn === OPS.paintInlineImageXObject) obj = args[0]
      else {
        try {
          obj = await Promise.race([
            new Promise((res) => page.objs.get(args[0], res)),
            new Promise((res) => setTimeout(() => res(null), 3000)),
          ])
        } catch { obj = null }
      }
      if (!obj) continue
      const w = Math.hypot(ctm[0], ctm[1]) || obj.width
      const h = Math.hypot(ctm[2], ctm[3]) || obj.height
      if (w < minSize || h < minSize) continue // skip bullets/icons
      found.push({ obj, x: ctm[4], top: ctm[5] + h, w, h })
    }
  }

  const out = []
  for (const f of found) {
    const bytes = await imageObjToPng(f.obj)
    if (bytes) out.push({ bytes, x: f.x, top: f.top, w: f.w, h: f.h })
  }
  return out
}

// pdf.js image object (bitmap or raw kind-tagged data) -> PNG bytes
async function imageObjToPng(obj) {
  const w = obj.width, h = obj.height
  if (!w || !h) return null
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  try {
    if (obj.bitmap) {
      ctx.drawImage(obj.bitmap, 0, 0)
    } else if (obj.data) {
      const img = ctx.createImageData(w, h)
      const d = img.data, s = obj.data
      if (obj.kind === 3) d.set(s) // RGBA_32BPP
      else if (obj.kind === 2) { // RGB_24BPP
        for (let i = 0, j = 0; i < w * h; i++) { d[i * 4] = s[j++]; d[i * 4 + 1] = s[j++]; d[i * 4 + 2] = s[j++]; d[i * 4 + 3] = 255 }
      } else if (obj.kind === 1) { // GRAYSCALE_1BPP, packed rows
        const rowBytes = (w + 7) >> 3
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const v = ((s[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1) ? 255 : 0
          const p = (y * w + x) * 4
          d[p] = d[p + 1] = d[p + 2] = v; d[p + 3] = 255
        }
      } else return null
      ctx.putImageData(img, 0, 0)
    } else return null
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'))
    if (!blob) return null
    return new Uint8Array(await blob.arrayBuffer())
  } catch {
    return null
  } finally {
    canvas.width = canvas.height = 0
  }
}

// Extract text grouped into visual lines: [{ y, items: [{ x, w, h, s }] }],
// sorted top-to-bottom, items left-to-right. Used by PDF→Word/Excel.
export async function extractLines(page) {
  const tc = await page.getTextContent()
  const lines = []
  for (const it of tc.items) {
    if (!it.str || !it.str.trim()) continue
    const x = it.transform[4], y = it.transform[5]
    const size = Math.hypot(it.transform[2], it.transform[3]) || 10
    let line = lines.find((l) => Math.abs(l.y - y) <= size * 0.4)
    if (!line) { line = { y, items: [] }; lines.push(line) }
    line.items.push({ x, w: it.width || 0, h: size, s: it.str })
  }
  lines.sort((a, b) => b.y - a.y)
  for (const l of lines) l.items.sort((a, b) => a.x - b.x)
  return lines
}
