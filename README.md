# Apollonians Read

Website audiobook responsif yang berjalan di GitHub Pages. Buku diproses dan disimpan di perangkat pengguna; akun dan metadata dapat disinkronkan menggunakan Supabase Free.

## Yang sudah berfungsi

- Impor PDF, EPUB, DOCX, TXT, Markdown, serta halaman atau file dari URL HTTPS yang mengizinkan CORS.
- Ekstraksi teks langsung di browser.
- TTS Bahasa Indonesia dengan Piper/ONNX, tanpa API berbayar.
- Penyimpanan buku dan WAV privat di IndexedDB/OPFS.
- Pemutar audio nyata dengan urutan beberapa bagian.
- Login, registrasi, dan sinkronisasi metadata opsional melalui Supabase.
- Static export responsif untuk GitHub Pages.

Piper mengunduh model Bahasa Indonesia sekitar 63 MB pada pemakaian pertama. Chrome atau Edge terbaru direkomendasikan karena fitur model lokal menggunakan Origin Private File System.

## Menjalankan secara lokal

Persyaratan: Node.js 22 atau lebih baru.

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`. Tanpa konfigurasi Supabase, aplikasi otomatis masuk ke **Mode lokal** dan fitur impor/TTS tetap dapat digunakan.

## Mengaktifkan Supabase Free

Supabase hanya menyimpan akun dan metadata. File buku, teks lengkap, dan audio tetap berada di perangkat pengguna agar kuota Storage gratis tidak cepat habis.

1. Buat proyek Free di [Supabase](https://supabase.com/dashboard).
2. Buka **SQL Editor**, salin dan jalankan [`supabase/schema.sql`](supabase/schema.sql).
3. Buka **Project Settings → API**.
4. Buka **Authentication → URL Configuration**, lalu isi Site URL dengan alamat GitHub Pages dan tambahkan alamat lokal sebagai redirect URL.
5. Salin `.env.example` menjadi `.env.local`.
6. Isi URL proyek dan **anon public key**:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_EXAMPLE
```

Jangan gunakan atau membagikan `service_role` maupun `sb_secret` key. Publishable key bukan secret server, tetapi seluruh tabel tetap wajib dilindungi RLS seperti pada skema proyek ini.

## Mengaktifkan Supabase di GitHub Pages

Di repository GitHub, buka **Settings → Secrets and variables → Actions → Variables**, lalu buat:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Gunakan **Variables**, bukan Secrets, karena nilai `NEXT_PUBLIC_*` memang dikompilasi ke JavaScript browser. Keamanan data berasal dari autentikasi dan Row Level Security.

Workflow `.github/workflows/deploy-pages.yml` membangun dan memublikasikan website setiap push ke branch `main`.

## Batasan penting

- Konversi berjalan di perangkat, sehingga tab harus tetap terbuka sampai selesai.
- Mode **Cuplikan cepat** membuat empat potongan, **Bab awal** membuat 24 potongan, dan **Buku penuh** memproses seluruh teks.
- URL lintas domain hanya dapat dibaca jika situs sumber mengizinkan CORS.
- MOBI dan buku ber-DRM belum didukung.
- Metadata dapat tersinkron antardevice, tetapi file/audio lokal tidak ikut tersinkron.
- Gunakan hanya buku yang kamu tulis, beli, atau memiliki izin untuk diproses.

## Struktur aplikasi

- `app/components` — UI multiview dan pemutar audio.
- `app/lib/document-parser.ts` — ekstraksi dokumen.
- `app/lib/local-db.ts` — penyimpanan IndexedDB.
- `app/lib/piper.ts` — TTS Bahasa Indonesia lokal.
- `app/lib/supabase.ts` — klien Supabase opsional.
- `supabase/schema.sql` — tabel dan kebijakan RLS.
- `.github/workflows` — deployment otomatis GitHub Pages.

Daftar lisensi komponen utama tersedia di [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
