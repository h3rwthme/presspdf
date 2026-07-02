# PressPDF Studio

[![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![pdf-lib](https://img.shields.io/badge/pdf-lib-1.17.1-FF6B6B)](https://pdf-lib.js.org/)
[![pdf.js](https://img.shields.io/badge/pdf.js-3.11.174-4B8BBE)](https://mozilla.github.io/pdf.js/)
[![JSZip](https://img.shields.io/badge/JSZip-3.10.1-5E8C5D)](https://stuk.github.io/jszip/)

PressPDF Studio adalah aplikasi web modern untuk mengolah PDF dan foto secara privat langsung di browser. Semua proses berjalan di perangkat Anda, tanpa upload ke server, sehingga cocok untuk kebutuhan harian yang cepat, aman, dan ringan.

## ✨ Fitur utama

### Atur PDF
- Gabungkan beberapa PDF menjadi satu file
- Pisahkan PDF per halaman atau rentang halaman
- Hapus halaman tertentu
- Ekstrak halaman pilihan

### Optimasi dan Konversi
- Kompres PDF dengan beberapa tingkat kualitas
- Konversi PDF ke JPG
- Konversi JPG/PNG/WebP ke PDF

### Edit PDF
- Putar halaman PDF
- Tambahkan watermark teks
- Sisipkan nomor halaman

### Alat Foto
- Hapus latar/background secara otomatis
- Perjelas dan tingkatkan kualitas foto HD
- Kompres foto tanpa ribet
- Hapus watermark dari gambar

## 🧰 Teknologi yang dipakai

- React 18 untuk UI interaktif
- Vite untuk development dan build cepat
- pdf-lib untuk manipulasi struktur PDF
- pdf.js untuk render halaman PDF
- JSZip untuk mengompres hasil multi-file
- Canvas-based image pipeline untuk editing foto lokal

## 📁 Struktur project

```text
src/
  components/      # UI reusable
  lib/             # helper PDF, image, theme, utility
  tools/           # semua tool yang tersedia
  App.jsx          # entry utama aplikasi
```

## ▶️ Cara menjalankan

```bash
npm install
npm run dev
```

Setelah itu, buka browser ke:

```text
http://localhost:5173
```

## 🏗️ Build untuk produksi

```bash
npm run build
```

Hasil build akan muncul di folder `dist/`.

## 🚀 Deploy ke GitHub Pages

```bash
npm run build
npm run deploy
```

Pastikan GitHub Pages sudah dikonfigurasi agar membaca folder `dist` dari branch `gh-pages`.

## 🔒 Privasi

Semua alat dirancang agar bekerja 100% di browser. File tidak dikirim ke server, sehingga lebih aman dan tetap bisa dipakai secara offline setelah halaman dimuat.

## ⚠️ Catatan penting

- Kompresi PDF yang agresif dapat mengurangi kualitas teks dan membuatnya tidak lagi bisa dipilih.
- Fitur yang melibatkan enkripsi PDF atau format Office yang kompleks belum didukung secara native di browser.

## 🤝 Kontribusi

Jika ingin membantu mengembangkan proyek ini, silakan fork repository, buat branch baru, lalu kirim pull request.

