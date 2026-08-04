# Apollonians Read

Website audiobook responsif yang berjalan di GitHub Pages. Buku diproses dan disimpan di perangkat pengguna; akun dan metadata dapat disinkronkan menggunakan Supabase Free.

## Yang sudah berfungsi

- Impor PDF, EPUB, DOCX, TXT, Markdown, serta halaman atau file dari URL HTTPS yang mengizinkan CORS.
- Ekstraksi teks langsung di browser.
- TTS Bahasa Indonesia dengan Piper/ONNX, tanpa API berbayar.
- Qwen3-TTS open-source sebagai worker opsional dan eksperimental.
- Penyimpanan buku dan WAV privat di IndexedDB/OPFS.
- Pemutar audio nyata dengan urutan beberapa bagian.
- Login, registrasi, dan sinkronisasi metadata opsional melalui Supabase.
- Static export responsif untuk GitHub Pages.
- Edit judul dan hapus buku pribadi langsung dari katalog.
- Panel superadmin untuk akun, status pengguna, kuota, dan konsumsi karakter.

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

## Membuat akun superadmin

Role superadmin tidak pernah ditentukan dari JavaScript browser. Cara aktivasi yang aman:

1. Jalankan skema terbaru di Supabase SQL Editor.
2. Daftar atau masuk melalui website menggunakan email admin.
3. Jalankan perintah berikut di SQL Editor dengan mengganti emailnya:

```sql
select public.promote_superadmin('email-admin@contoh.com');
```

4. Keluar lalu masuk kembali. Menu **Superadmin** akan muncul di desktop dan mobile.

Fungsi promosi telah dicabut dari role `anon` dan `authenticated`, sehingga tidak dapat dipanggil pengguna dari browser. Panel admin dapat melihat metadata operasional, tetapi tidak menerima file, teks lengkap, atau audio pengguna.

## Mengaktifkan Qwen3-TTS opsional

Qwen tidak dijalankan di GitHub Pages. Jalankan worker pada komputer/server yang memiliki RAM memadai dan, idealnya, GPU:

```bash
cd services/qwen-tts
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
set -a; source .env; set +a
uvicorn main:app --host 0.0.0.0 --port 8000
```

Worker memakai Qwen3-TTS 0.6B resmi. Ia memverifikasi session Supabase, melakukan reservasi kuota sebelum inferensi, dan tidak membutuhkan `service_role` key. Untuk website publik, worker wajib tersedia melalui HTTPS dan `ALLOWED_ORIGINS` harus berisi origin GitHub Pages secara tepat.

Tambahkan URL HTTPS tersebut sebagai GitHub Actions Variable:

```dotenv
NEXT_PUBLIC_QWEN_TTS_ENDPOINT=https://qwen-worker.example.com
```

Setelah website dideploy ulang, aktifkan Qwen dari panel Superadmin. Integrasi Qwen menggunakan Bahasa Inggris dengan suara **Ryan**, sedangkan Piper tetap menjadi pilihan Bahasa Indonesia. Pilihan bahasa di Studio mengikuti mesin audio secara otomatis.

## Batasan penting

- Konversi berjalan di perangkat, sehingga tab harus tetap terbuka sampai selesai.
- Konversi Qwen berjalan di worker privat dan hanya tersedia untuk akun yang login serta memiliki kuota.
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
- `app/lib/qwen.ts` — klien worker Qwen terautentikasi.
- `app/components/AdminView.tsx` — monitoring dan kontrol konsumsi superadmin.
- `app/lib/supabase.ts` — klien Supabase opsional.
- `supabase/schema.sql` — tabel dan kebijakan RLS.
- `services/qwen-tts` — worker Qwen3-TTS mandiri.
- `.github/workflows` — deployment otomatis GitHub Pages.

Daftar lisensi komponen utama tersedia di [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
