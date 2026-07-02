// Client-side image toolkit — everything runs in-canvas, nothing leaves the device.

export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Gambar tidak bisa dibaca.')) }
    img.src = url
  })
}

export function newCanvas(w, h) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

// Draw an image/canvas into a fresh canvas, optionally clamped to a max dimension.
export function toCanvas(src, maxDim = 0) {
  let w = src.naturalWidth || src.width
  let h = src.naturalHeight || src.height
  if (maxDim && Math.max(w, h) > maxDim) {
    const k = maxDim / Math.max(w, h)
    w = Math.round(w * k)
    h = Math.round(h * k)
  }
  const c = newCanvas(w, h)
  const ctx = c.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, c.width, c.height)
  return c
}

export const canvasToBlob = (canvas, type = 'image/png', quality) =>
  new Promise((res) => canvas.toBlob(res, type, quality))

// High-quality resize with progressive halving (better than a single big jump).
export function resizeCanvas(src, targetW, targetH) {
  let cur = src
  let cw = src.width, ch = src.height
  // step down by halves until within 2x of target
  while (cw > targetW * 2 && ch > targetH * 2) {
    const next = newCanvas(cw / 2, ch / 2)
    const nx = next.getContext('2d')
    nx.imageSmoothingEnabled = true; nx.imageSmoothingQuality = 'high'
    nx.drawImage(cur, 0, 0, next.width, next.height)
    cur = next; cw = next.width; ch = next.height
  }
  const out = newCanvas(targetW, targetH)
  const ctx = out.getContext('2d')
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(cur, 0, 0, out.width, out.height)
  return out
}

// Per-pixel tone adjustment. b/c/s expressed as multipliers around 1.
export function adjust(canvas, { brightness = 1, contrast = 1, saturation = 1 } = {}) {
  const ctx = canvas.getContext('2d')
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  const c = contrast
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2]
    // brightness
    r *= brightness; g *= brightness; b *= brightness
    // contrast around mid-grey
    r = (r - 128) * c + 128
    g = (g - 128) * c + 128
    b = (b - 128) * c + 128
    // saturation via luma
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b
    r = l + (r - l) * saturation
    g = l + (g - l) * saturation
    b = l + (b - l) * saturation
    d[i] = clamp(r); d[i + 1] = clamp(g); d[i + 2] = clamp(b)
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

// Unsharp mask: amount 0..1.5, radius in px (1 = light).
export function sharpen(canvas, amount = 0.6) {
  if (amount <= 0) return canvas
  const w = canvas.width, h = canvas.height
  const ctx = canvas.getContext('2d')
  const src = ctx.getImageData(0, 0, w, h)
  const out = ctx.createImageData(w, h)
  const s = src.data, o = out.data
  const k = amount
  // 3x3 sharpen kernel scaled by amount
  const center = 1 + 4 * k
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      for (let c = 0; c < 3; c++) {
        const up = y > 0 ? s[i - w * 4 + c] : s[i + c]
        const dn = y < h - 1 ? s[i + w * 4 + c] : s[i + c]
        const lf = x > 0 ? s[i - 4 + c] : s[i + c]
        const rt = x < w - 1 ? s[i + 4 + c] : s[i + c]
        o[i + c] = clamp(center * s[i + c] - k * (up + dn + lf + rt))
      }
      o[i + 3] = s[i + 3]
    }
  }
  ctx.putImageData(out, 0, 0)
  return canvas
}

// Light denoise via 3x3 box blur mixed back by `strength` (0..1).
export function denoise(canvas, strength = 0.3) {
  if (strength <= 0) return canvas
  const w = canvas.width, h = canvas.height
  const ctx = canvas.getContext('2d')
  const src = ctx.getImageData(0, 0, w, h)
  const out = ctx.createImageData(w, h)
  const s = src.data, o = out.data
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      for (let c = 0; c < 3; c++) {
        let sum = 0, n = 0
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy, xx = x + dx
          if (yy < 0 || yy >= h || xx < 0 || xx >= w) continue
          sum += s[(yy * w + xx) * 4 + c]; n++
        }
        const avg = sum / n
        o[i + c] = clamp(s[i + c] * (1 - strength) + avg * strength)
      }
      o[i + 3] = s[i + 3]
    }
  }
  ctx.putImageData(out, 0, 0)
  return canvas
}

// Background removal by flood-fill from the borders. Works best on plain/near-plain
// backgrounds (product shots, portraits on solid colour). tolerance 0..1.
export function removeBackground(canvas, { tolerance = 0.14, feather = 2 } = {}) {
  const w = canvas.width, h = canvas.height
  const ctx = canvas.getContext('2d')
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  const tol = (tolerance * 255) ** 2 * 3
  const visited = new Uint8Array(w * h)
  const stack = []
  // seed from every border pixel
  for (let x = 0; x < w; x++) { stack.push(x); stack.push((h - 1) * w + x) }
  for (let y = 0; y < h; y++) { stack.push(y * w); stack.push(y * w + w - 1) }
  // reference background colours: sampled from corners + edge midpoints (this image only)
  const refPts = [0, w - 1, (h - 1) * w, h * w - 1, ((h / 2) | 0) * w, ((h / 2) | 0) * w + w - 1]
  const refs = refPts.map((p) => [d[p * 4], d[p * 4 + 1], d[p * 4 + 2]])
  while (stack.length) {
    const p = stack.pop()
    if (visited[p]) continue
    visited[p] = 1
    const x = p % w, y = (p / w) | 0
    const r = d[p * 4], g = d[p * 4 + 1], b = d[p * 4 + 2]
    let match = false
    for (const ref of refs) {
      const dr = r - ref[0], dg = g - ref[1], db = b - ref[2]
      if (dr * dr + dg * dg + db * db <= tol) { match = true; break }
    }
    if (!match) continue
    d[p * 4 + 3] = 0 // transparent
    if (x > 0) stack.push(p - 1)
    if (x < w - 1) stack.push(p + 1)
    if (y > 0) stack.push(p - w)
    if (y < h - 1) stack.push(p + w)
  }
  ctx.putImageData(img, 0, 0)
  if (feather > 0) featherAlpha(canvas, feather)
  return canvas
}

// Soften the alpha edge so cut-outs don't look jagged.
function featherAlpha(canvas, radius) {
  const w = canvas.width, h = canvas.height
  const ctx = canvas.getContext('2d')
  const img = ctx.getImageData(0, 0, w, h)
  const a = new Uint8ClampedArray(w * h)
  for (let i = 0; i < w * h; i++) a[i] = img.data[i * 4 + 3]
  const out = new Uint8ClampedArray(w * h)
  const r = Math.max(1, radius | 0)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let sum = 0, n = 0
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const yy = y + dy, xx = x + dx
      if (yy < 0 || yy >= h || xx < 0 || xx >= w) continue
      sum += a[yy * w + xx]; n++
    }
    out[y * w + x] = sum / n
  }
  for (let i = 0; i < w * h; i++) img.data[i * 4 + 3] = out[i]
  ctx.putImageData(img, 0, 0)
}

// Inpaint the pixels flagged in `mask` (Uint8Array, 1 = fill) by diffusing colour
// inward from the surrounding known pixels. Used by the watermark remover.
export function inpaint(canvas, mask, iterations = 60) {
  const w = canvas.width, h = canvas.height
  const ctx = canvas.getContext('2d')
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  const hole = Uint8Array.from(mask)
  // seed holes with the average of known neighbours to speed convergence
  for (let it = 0; it < iterations; it++) {
    let changed = false
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x
      if (!hole[p]) continue
      let r = 0, g = 0, b = 0, n = 0
      for (const [dx, dy] of NEI) {
        const xx = x + dx, yy = y + dy
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
        const q = yy * w + xx
        if (hole[q] === 1) continue // skip still-empty holes
        r += d[q * 4]; g += d[q * 4 + 1]; b += d[q * 4 + 2]; n++
      }
      if (n > 0) {
        d[p * 4] = r / n; d[p * 4 + 1] = g / n; d[p * 4 + 2] = b / n; d[p * 4 + 3] = 255
        hole[p] = 2 // now filled (usable as a neighbour next pass)
        changed = true
      }
    }
    // promote filled holes to known for the next iteration
    for (let i = 0; i < hole.length; i++) if (hole[i] === 2) hole[i] = 0
    if (!changed) break
  }
  ctx.putImageData(img, 0, 0)
  // gentle smoothing pass over the repaired region
  return canvas
}
const NEI = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]

function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v }

// Composite an RGBA canvas onto a solid colour (for JPEG export of transparent cut-outs).
export function flatten(canvas, bg = '#FFFFFF') {
  const out = newCanvas(canvas.width, canvas.height)
  const ctx = out.getContext('2d')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(canvas, 0, 0)
  return out
}
