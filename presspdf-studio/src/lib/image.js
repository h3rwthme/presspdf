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

// --- Background removal, v2 ---------------------------------------------
// 1. Sample the border ring and cluster its colours (backgrounds are rarely
//    a single flat colour — gradients/vignettes need several references).
// 2. Score every pixel by its distance to the nearest background cluster.
// 3. Flood-fill from the borders through "background-like" pixels only, so
//    matching colours *inside* the subject are never deleted.
// 4. Soft alpha ramp between two thresholds instead of a hard cut.
function borderClusters(d, w, h) {
  // quantise border pixels into a coarse RGB grid, keep dominant cells
  const cells = new Map()
  const push = (p) => {
    const r = d[p * 4], g = d[p * 4 + 1], b = d[p * 4 + 2]
    const key = ((r >> 5) << 10) | ((g >> 5) << 5) | (b >> 5)
    const c = cells.get(key) || { r: 0, g: 0, b: 0, n: 0 }
    c.r += r; c.g += g; c.b += b; c.n++
    cells.set(key, c)
  }
  const ring = 2
  for (let t = 0; t < ring; t++) {
    for (let x = 0; x < w; x++) { push(t * w + x); push((h - 1 - t) * w + x) }
    for (let y = 0; y < h; y++) { push(y * w + t); push(y * w + (w - 1 - t)) }
  }
  const total = [...cells.values()].reduce((s, c) => s + c.n, 0)
  return [...cells.values()]
    .sort((a, b) => b.n - a.n)
    .filter((c, i) => i < 4 && c.n / total > 0.04) // up to 4 clusters, ≥4% of border each
    .map((c) => [c.r / c.n, c.g / c.n, c.b / c.n])
}

export function removeBackground(canvas, { tolerance = 0.16, feather = 2 } = {}) {
  const w = canvas.width, h = canvas.height
  const ctx = canvas.getContext('2d')
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  const refs = borderClusters(d, w, h)
  if (!refs.length) return canvas

  const tHi = (tolerance * 441) ** 2          // outer threshold: "could be background"
  const tLo = (tolerance * 0.55 * 441) ** 2   // inner threshold: "definitely background"

  // distance of every pixel to nearest bg cluster
  const dist = new Float32Array(w * h)
  for (let p = 0; p < w * h; p++) {
    const r = d[p * 4], g = d[p * 4 + 1], b = d[p * 4 + 2]
    let best = Infinity
    for (const [rr, rg, rb] of refs) {
      const dr = r - rr, dg = g - rg, db = b - rb
      const q = dr * dr + dg * dg + db * db
      if (q < best) best = q
    }
    dist[p] = best
  }

  // connectivity: only pixels reachable from the border through bg-like colour
  const mask = new Uint8Array(w * h) // 1 = background
  const stack = []
  for (let x = 0; x < w; x++) { stack.push(x); stack.push((h - 1) * w + x) }
  for (let y = 0; y < h; y++) { stack.push(y * w); stack.push(y * w + w - 1) }
  while (stack.length) {
    const p = stack.pop()
    if (mask[p] || dist[p] > tHi) continue
    mask[p] = 1
    const x = p % w, y = (p / w) | 0
    if (x > 0) stack.push(p - 1)
    if (x < w - 1) stack.push(p + 1)
    if (y > 0) stack.push(p - w)
    if (y < h - 1) stack.push(p + w)
  }

  // soft alpha: 0 inside tLo, ramp tLo..tHi
  for (let p = 0; p < w * h; p++) {
    if (!mask[p]) continue
    const q = dist[p]
    const a = q <= tLo ? 0 : Math.min(1, (q - tLo) / (tHi - tLo))
    d[p * 4 + 3] = Math.min(d[p * 4 + 3], Math.round(a * a * 255))
  }
  ctx.putImageData(img, 0, 0)
  if (feather > 0) featherAlpha(canvas, feather)
  return canvas
}

// Click-to-erase (magic wand): flood from the tapped point through similar
// colour, erase that region only. Returns number of erased pixels.
export function floodErase(canvas, sx, sy, tolerance = 0.16) {
  const w = canvas.width, h = canvas.height
  sx |= 0; sy |= 0
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return 0
  const ctx = canvas.getContext('2d')
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  const p0 = sy * w + sx
  if (d[p0 * 4 + 3] === 0) return 0
  const sr = d[p0 * 4], sg = d[p0 * 4 + 1], sb = d[p0 * 4 + 2]
  const tHi = (tolerance * 441) ** 2
  const tLo = (tolerance * 0.6 * 441) ** 2
  const seen = new Uint8Array(w * h)
  const stack = [p0]
  let count = 0
  let minX = sx, maxX = sx, minY = sy, maxY = sy
  while (stack.length) {
    const p = stack.pop()
    if (seen[p]) continue
    seen[p] = 1
    const i = p * 4
    if (d[i + 3] === 0) continue
    const dr = d[i] - sr, dg = d[i + 1] - sg, db = d[i + 2] - sb
    const q = dr * dr + dg * dg + db * db
    if (q > tHi) continue
    const a = q <= tLo ? 0 : Math.min(1, (q - tLo) / (tHi - tLo))
    d[i + 3] = Math.min(d[i + 3], Math.round(a * a * 255))
    count++
    const x = p % w, y = (p / w) | 0
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (y < minY) minY = y; if (y > maxY) maxY = y
    if (x > 0) stack.push(p - 1)
    if (x < w - 1) stack.push(p + 1)
    if (y > 0) stack.push(p - w)
    if (y < h - 1) stack.push(p + w)
  }
  ctx.putImageData(img, 0, 0)
  return count
}

// Percentile-based auto contrast/levels — makes "enhance" visibly better on
// dull photos without wrecking already-good ones. clip = % of pixels ignored.
export function autoLevels(canvas, clip = 0.005, strength = 1) {
  const ctx = canvas.getContext('2d')
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  const histo = new Uint32Array(256)
  for (let i = 0; i < d.length; i += 4) {
    histo[(d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722) | 0]++
  }
  const total = d.length / 4
  const clipN = total * clip
  let lo = 0, hi = 255, acc = 0
  for (let v = 0; v < 256; v++) { acc += histo[v]; if (acc > clipN) { lo = v; break } }
  acc = 0
  for (let v = 255; v >= 0; v--) { acc += histo[v]; if (acc > clipN) { hi = v; break } }
  if (hi - lo < 10 || (lo < 6 && hi > 249)) return canvas // already full-range
  const scale = 255 / (hi - lo)
  const lut = new Uint8ClampedArray(256)
  for (let v = 0; v < 256; v++) {
    const stretched = (v - lo) * scale
    lut[v] = v + (stretched - v) * strength
  }
  for (let i = 0; i < d.length; i += 4) {
    d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]]
  }
  ctx.putImageData(img, 0, 0)
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

// --- Inpainting, v2: multi-scale (pyramid) diffusion ----------------------
// Diffusion at full resolution creeps in from the edges and leaves big holes
// smeary. Instead: downsample image+mask until the hole is a few pixels wide,
// fill it there (cheap + converges instantly), then upsample and refine at
// each level. Large watermarks now fill with smooth, plausible colour.
export function inpaint(canvas, mask) {
  const w = canvas.width, h = canvas.height
  // pyramid of {img: canvas, hole: Uint8Array}
  const levels = [{ c: canvas, hole: Uint8Array.from(mask), w, h }]
  while (levels[levels.length - 1].w > 32 && levels[levels.length - 1].h > 32 && levels.length < 8) {
    const prev = levels[levels.length - 1]
    const nw = Math.max(16, prev.w >> 1), nh = Math.max(16, prev.h >> 1)
    const c = newCanvas(nw, nh)
    const cx = c.getContext('2d')
    cx.imageSmoothingEnabled = true
    cx.drawImage(prev.c, 0, 0, nw, nh)
    const hole = new Uint8Array(nw * nh)
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      // a low-res pixel is a hole if any of its 2x2 source pixels was
      const sx = x * 2, sy = y * 2
      hole[y * nw + x] = (
        prev.hole[sy * prev.w + sx] ||
        (sx + 1 < prev.w && prev.hole[sy * prev.w + sx + 1]) ||
        (sy + 1 < prev.h && prev.hole[(sy + 1) * prev.w + sx]) ||
        (sx + 1 < prev.w && sy + 1 < prev.h && prev.hole[(sy + 1) * prev.w + sx + 1])
      ) ? 1 : 0
    }
    levels.push({ c, hole, w: nw, h: nh })
  }

  // fill coarsest level fully, then refine upward
  diffuse(levels[levels.length - 1], 200, false)
  for (let li = levels.length - 2; li >= 0; li--) {
    const cur = levels[li], low = levels[li + 1]
    // paste upsampled fill into hole pixels only
    const up = newCanvas(cur.w, cur.h)
    const ux = up.getContext('2d')
    ux.imageSmoothingEnabled = true
    ux.imageSmoothingQuality = 'high'
    ux.drawImage(low.c, 0, 0, cur.w, cur.h)
    const ctx = cur.c.getContext('2d')
    const img = ctx.getImageData(0, 0, cur.w, cur.h)
    const upImg = ux.getImageData(0, 0, cur.w, cur.h)
    for (let p = 0; p < cur.w * cur.h; p++) {
      if (!cur.hole[p]) continue
      img.data[p * 4] = upImg.data[p * 4]
      img.data[p * 4 + 1] = upImg.data[p * 4 + 1]
      img.data[p * 4 + 2] = upImg.data[p * 4 + 2]
      img.data[p * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
    diffuse(cur, 6, true) // smoothing passes to blend seams
  }
  return canvas
}

const NEI = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]

// In-place diffusion over hole pixels. seeded=false: progressive fill from the
// hole boundary inward (holes start with no value). seeded=true: holes already
// hold values (pasted from the coarser level) — pure Jacobi smoothing.
function diffuse(level, iterations, seeded) {
  const { c, hole, w, h } = level
  const ctx = c.getContext('2d')
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  const state = seeded ? null : Uint8Array.from(hole) // 1 = unfilled, 0 = known
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
        if (state && state[q] === 1) continue
        r += d[q * 4]; g += d[q * 4 + 1]; b += d[q * 4 + 2]; n++
      }
      if (n > 0) {
        d[p * 4] = r / n; d[p * 4 + 1] = g / n; d[p * 4 + 2] = b / n; d[p * 4 + 3] = 255
        if (state && state[p] === 1) { state[p] = 2; changed = true }
      }
    }
    if (state) {
      for (let i = 0; i < state.length; i++) if (state[i] === 2) state[i] = 0
      if (!changed && it > 2) break
    }
  }
  ctx.putImageData(img, 0, 0)
}

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
