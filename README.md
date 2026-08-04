# Apollonians Read

Website audiobook responsif untuk mengelola koleksi, mengunggah atau menautkan buku, memantau proses konversi, dan mendengarkan narasi dari suara bawaan browser.

## Menjalankan lokal

Persyaratan: Node.js 22 atau lebih baru.

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`. Versi GitHub Pages tidak membutuhkan API key.

## Publikasi melalui GitHub Pages

Workflow `.github/workflows/deploy-pages.yml` otomatis membangun dan memublikasikan website setiap kali ada perubahan yang di-push ke branch `main`.

1. Push repository ke GitHub.
2. Buka **Settings → Pages** di repository.
3. Pada **Build and deployment**, pilih **GitHub Actions**.
4. Buka tab **Actions** untuk melihat proses publikasi.

Alamat website akan mengikuti format `https://USERNAME.github.io/NAMA-REPOSITORY/`.

## Format sumber

Antarmuka menerima PDF, EPUB, MOBI, DOCX, TXT, dan Markdown hingga 50 MB, serta tautan HTTPS. Saat ini pemrosesan buku penuh masih berupa alur antrean pada frontend. GitHub Pages tidak dapat menjalankan ekstraksi dokumen, penyimpanan file, atau menghasilkan MP3 di server; kemampuan tersebut memerlukan backend terpisah.

## Struktur aplikasi

- `app/components` — komponen dan tampilan aplikasi.
- `app/lib` — tipe serta data contoh.
- `app/globals.css` — design system dan layout responsif.
- `.github/workflows` — deployment otomatis ke GitHub Pages.
