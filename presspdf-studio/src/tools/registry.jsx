import Merge from './Merge'
import Split from './Split'
import Compress from './Compress'
import Rotate from './Rotate'
import Pages from './Pages'
import PdfToJpg from './PdfToJpg'
import JpgToPdf from './JpgToPdf'
import Watermark from './Watermark'
import PageNumbers from './PageNumbers'
import RemoveBg from './RemoveBg'
import EnhanceHd from './EnhanceHd'
import CompressPhoto from './CompressPhoto'
import WatermarkRemove from './WatermarkRemove'
import PdfToWord from './PdfToWord'
import PdfToPpt from './PdfToPpt'
import PdfToExcel from './PdfToExcel'
import WordToPdf from './WordToPdf'
import PptToPdf from './PptToPdf'
import ExcelToPdf from './ExcelToPdf'
import EditPdf from './EditPdf'

// Category metadata: label + icon + accent tokens (defined in styles.css).
export const CATS = [
  { id: 'organize', label: 'Atur PDF',   icon: 'organize', color: 'var(--c-organize)', bg: 'var(--c-organize-bg)' },
  { id: 'optimize', label: 'Optimalkan', icon: 'optimize', color: 'var(--c-optimize)', bg: 'var(--c-optimize-bg)' },
  { id: 'convert',  label: 'Konversi',   icon: 'convert',  color: 'var(--c-convert)',  bg: 'var(--c-convert-bg)' },
  { id: 'edit',     label: 'Edit PDF',   icon: 'edit',     color: 'var(--c-edit)',     bg: 'var(--c-edit-bg)' },
  { id: 'photo',    label: 'Foto',       icon: 'photo',    color: 'var(--c-photo)',    bg: 'var(--c-photo-bg)' },
]

export const TOOLS = [
  // ---- Atur PDF ----
  { id: 'merge',    cat: 'organize', icon: 'merge',        name: 'Gabungkan PDF',   desc: 'Satukan banyak PDF jadi satu, urutan bisa diatur bebas.', comp: Merge },
  { id: 'split',    cat: 'organize', icon: 'split',        name: 'Pisahkan PDF',    desc: 'Ambil rentang halaman atau pecah tiap halaman jadi ZIP.', comp: Split },
  { id: 'delete',   cat: 'organize', icon: 'delete-page',  name: 'Hapus Halaman',   desc: 'Buang halaman tertentu dengan pilih visual atau rentang.', comp: (p) => <Pages {...p} mode="delete" /> },
  { id: 'extract',  cat: 'organize', icon: 'extract',      name: 'Ekstrak Halaman', desc: 'Ambil halaman terpilih jadi dokumen PDF baru.', comp: (p) => <Pages {...p} mode="extract" /> },

  // ---- Optimalkan ----
  { id: 'compress', cat: 'optimize', icon: 'compress',     name: 'Kompres PDF',     desc: 'Perkecil ukuran file dengan 3 tingkat kompresi pintar.', comp: Compress },

  // ---- Konversi ----
  { id: 'pdf2jpg',  cat: 'convert',  icon: 'image',        name: 'PDF ke JPG',      desc: 'Render tiap halaman jadi gambar JPG resolusi tinggi.', comp: PdfToJpg },
  { id: 'jpg2pdf',  cat: 'convert',  icon: 'file',         name: 'JPG ke PDF',      desc: 'Susun foto JPG/PNG jadi satu PDF rapi.', comp: JpgToPdf },
  { id: 'pdf2word', cat: 'convert',  icon: 'word',         name: 'PDF ke Word',     desc: 'Ekstrak teks & judul jadi dokumen .docx yang bisa diedit.', comp: PdfToWord },
  { id: 'pdf2ppt',  cat: 'convert',  icon: 'ppt',          name: 'PDF ke PowerPoint', desc: 'Tiap halaman jadi satu slide presentasi .pptx.', comp: PdfToPpt },
  { id: 'pdf2excel',cat: 'convert',  icon: 'excel',        name: 'PDF ke Excel',    desc: 'Ekstrak tabel & angka jadi spreadsheet .xlsx.', comp: PdfToExcel },
  { id: 'word2pdf', cat: 'convert',  icon: 'word',         name: 'Word ke PDF',     desc: 'Ubah dokumen .docx / .txt jadi PDF dengan layout rapi.', comp: WordToPdf },
  { id: 'ppt2pdf',  cat: 'convert',  icon: 'ppt',          name: 'PowerPoint ke PDF', desc: 'Ubah presentasi .pptx jadi PDF, teks & gambar ikut.', comp: PptToPdf },
  { id: 'excel2pdf',cat: 'convert',  icon: 'excel',        name: 'Excel ke PDF',    desc: 'Ubah .xlsx / CSV jadi tabel PDF yang rapi.', comp: ExcelToPdf },

  // ---- Edit PDF ----
  { id: 'rotate',   cat: 'edit',     icon: 'rotate',       name: 'Putar PDF',       desc: 'Putar semua atau sebagian halaman dengan pratinjau.', comp: Rotate },
  { id: 'watermark',cat: 'edit',     icon: 'watermark',    name: 'Tanda Air',       desc: 'Bubuhkan watermark teks diagonal, atur gaya & transparansi.', comp: Watermark },
  { id: 'numbers',  cat: 'edit',     icon: 'numbers',      name: 'Nomor Halaman',   desc: 'Sisipkan nomor halaman dengan posisi & format pilihan.', comp: PageNumbers },
  { id: 'editpdf',  cat: 'edit',     icon: 'edit-pdf',     name: 'Edit PDF',        desc: 'Tambahkan teks, anotasi, dan markup langsung pada dokumen PDF.', comp: EditPdf },

  // ---- Foto ----
  { id: 'removebg', cat: 'photo',    icon: 'remove-bg',    name: 'Hapus Latar',     desc: 'Klik area latar untuk menghapusnya, atau pakai mode otomatis.', comp: RemoveBg },
  { id: 'hdphoto',  cat: 'photo',    icon: 'enhance',      name: 'Perjelas HD',     desc: 'Perbesar sampai 4× dengan perbaikan cahaya & ketajaman.', comp: EnhanceHd },
  { id: 'imgcompress', cat: 'photo', icon: 'compress-photo', name: 'Kompres Foto',  desc: 'Kecilkan JPG/PNG/WebP, langsung terlihat hematnya.', comp: CompressPhoto },
  { id: 'wmremove', cat: 'photo',    icon: 'watermark-off', name: 'Hapus Watermark', desc: 'Sapu watermark pada foto, area terisi ulang otomatis.', comp: WatermarkRemove },
]

export const catOf = (id) => CATS.find((c) => c.id === id)
