# PressPDF Studio

Studio alat **PDF & Foto** ala iLovePDF — **semua proses 100% di perangkatmu**
(browser/desktop), tidak ada file yang di-upload ke server mana pun. Antarmuka
minimalis dengan ikon garis (tanpa emoji), mode terang/gelap, animasi halus, dan
responsif sampai layar ~5,8 inci.

## Alat yang tersedia

| Kategori | Alat |
|---|---|
| Atur PDF | Gabungkan, Pisahkan (rentang / per halaman → ZIP), Hapus Halaman, Ekstrak Halaman |
| Optimalkan | Kompres PDF (3 tingkat: Ringan / Rekomendasi / Ekstrem) |
| Konversi | PDF → JPG (Normal/Tinggi/Ultra, ZIP multi-halaman), JPG/PNG/WebP → PDF (ukuran gambar atau A4 + orientasi) |
| Edit PDF | Putar PDF, Tanda Air (diagonal / ubin, warna & transparansi), Nomor Halaman (6 posisi, nomor awal) |
| **Foto** | **Hapus Latar** (otomatis + kuas), **Perjelas HD** (perbesar 2×/4× + pertajam), **Kompres Foto** (JPG/WebP/PNG), **Hapus Watermark** (kuas + isi ulang) |

Semua alat foto berjalan murni di `<canvas>` — tanpa server, tanpa model AI berat,
jadi tetap cepat dan privat serta bisa dipakai offline.

Stack: **React + Vite**, `pdf-lib` (struktur PDF), `pdfjs-dist` (render halaman),
`jszip`, plus pipeline gambar sendiri di `src/lib/image.js`
(resize bertingkat, unsharp mask, denoise, flood-fill background removal, inpaint).

> Catatan kompresi: teknik yang dipakai adalah render-ulang halaman ke JPEG (seperti mode
> "extreme" layanan online). Sangat efektif untuk scan/nota, tapi teks hasil kompresi
> tidak bisa di-select lagi. Alat lain (gabung, pisah, putar, dll.) mempertahankan PDF asli 100%.

## Jalankan lokal (development)

```bash
npm install
npm run dev        # buka http://localhost:5173
```

## Deploy ke GitHub Pages

**Cara otomatis (disarankan):**
1. Buat repo baru di GitHub, push seluruh folder ini ke branch `main`.
2. Di repo: **Settings → Pages → Source: GitHub Actions**.
3. Selesai — setiap push ke `main`, workflow `.github/workflows/deploy.yml`
   akan build & publish. URL-nya: `https://<username>.github.io/<nama-repo>/`

**Cara manual:**
```bash
npm run build
npm run deploy     # pakai paket gh-pages, push folder dist ke branch gh-pages
```
Lalu di Settings → Pages pilih branch `gh-pages`.

`vite.config.js` sudah memakai `base: './'`, jadi aman di subpath repo mana pun
tanpa perlu diubah-ubah.

## Jadikan aplikasi desktop native (Tauri — disarankan)

Tauri menghasilkan `.exe` / `.dmg` / `.AppImage` kecil (±5–10 MB) dan cepat.
Butuh Rust terpasang (https://rustup.rs).

```bash
npm install -D @tauri-apps/cli
npx tauri init
# saat ditanya:
#   dev server URL     : http://localhost:5173
#   frontend dist path : ../dist
#   dev command        : npm run dev
#   build command      : npm run build

npx tauri dev      # jalankan sebagai app desktop (mode dev)
npx tauri build    # hasilkan installer di src-tauri/target/release/bundle/
```

Alternatif: Electron juga bisa (lebih berat, ±80 MB+), tapi untuk app seperti ini
Tauri jauh lebih efisien.

## Mobile

UI sudah responsif — di HP tinggal buka URL GitHub Pages-nya, lalu
**Add to Home Screen** dari browser supaya terasa seperti app.

## Batasan (jujur-jujuran)

- **Buka kunci / proteksi password**: enkripsi PDF tidak didukung `pdf-lib` di browser.
  Untuk ini pakai `qpdf` di lokal: `qpdf --decrypt terkunci.pdf terbuka.pdf`.
- **PDF ↔ Word/Excel/PowerPoint**: konversi format Office butuh engine besar
  (LibreOffice dsb.) — tidak realistis murni client-side.
- **OCR**: bisa ditambahkan dengan `tesseract.js` kalau nanti dibutuhkan.
