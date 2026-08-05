# Apollonians Read

Apollonians Read adalah aplikasi audiobook **gratis, wajib login, dan local-first**. Frontend dibangun dengan Next.js static export, autentikasi dan metadata memakai Supabase Free, sedangkan Edge TTS dilayani oleh Oracle Free VM melalui `https://apollonians.duckdns.org`. Piper tetap tersedia sebagai fallback lokal.

## Fitur utama

- Login, registrasi, verifikasi email, dan reset password wajib melalui Supabase.
- Impor PDF, EPUB, DOCX, TXT, Markdown, serta URL HTTPS yang mengizinkan CORS.
- Edge TTS online dengan pilihan suara, preview, rate, pitch, dan volume.
- Piper Bahasa Indonesia sebagai fallback lokal/offline setelah model tersedia.
- Buku, teks, audio, posisi playback, preferensi, dan aktivitas dipisahkan per akun pada perangkat.
- Metadata katalog dapat disinkronkan; file asli dan audio tetap berada di perangkat.
- Panel superadmin untuk status akun, kuota harian, batas global, dan aktivasi Edge TTS.
- CI memblokir deployment bila lint, TypeScript, production build, atau test gagal.

## Arsitektur

```text
Browser
├── Next.js static application
├── Supabase authentication
├── document parsing
├── IndexedDB account-scoped storage
├── Piper local fallback
└── Edge TTS client
        │ Bearer token Supabase
        ▼
apollonians.duckdns.org
└── Oracle Free VM
    ├── HTTPS reverse proxy
    └── FastAPI Edge TTS service
            │
            ├── verifies Supabase session
            ├── reserves usage quota
            ├── queues one job at a time
            └── streams MP3 back to browser
```

Edge TTS menggunakan layanan suara online Microsoft Edge melalui library `edge-tts`. Oracle VM bertindak sebagai gateway terautentikasi dan pengelola antrean, bukan host model AI berat.

## Menjalankan frontend secara lokal

Persyaratan: Node.js 22 atau lebih baru.

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Isi `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_EXAMPLE
NEXT_PUBLIC_EDGE_TTS_ENDPOINT=https://apollonians.duckdns.org
```

Tanpa konfigurasi Supabase, aplikasi **tidak membuka mode tamu**. Auth gate akan menampilkan bahwa layanan autentikasi belum dikonfigurasi.

## Menyiapkan Supabase Free

Untuk proyek baru:

1. Buat proyek Supabase Free.
2. Jalankan `supabase/schema.sql` melalui SQL Editor.
3. Aktifkan konfirmasi email sesuai kebutuhan.
4. Atur Site URL dan redirect URL untuk domain produksi dan `http://localhost:3000`.
5. Gunakan project URL dan publishable key pada frontend serta service Edge TTS.

Untuk database yang sebelumnya memakai Qwen, jalankan:

```text
supabase/migrations/20260805_edge_tts.sql
```

Migrasi tersebut:

- mengubah histori engine `qwen` menjadi `edge`;
- mengganti constraint engine;
- memigrasikan `qwen_enabled` menjadi `edge_tts_enabled`;
- memperbarui fungsi reservasi kuota;
- menyediakan `get_quota_info`.

Jangan pernah menyimpan `service_role`, `sb_secret`, kredensial Oracle, atau private key pada repository maupun variabel `NEXT_PUBLIC_*`.

## Menjalankan Edge TTS di Oracle Free VM

```bash
sudo mkdir -p /opt/apollonians-read /etc/apollonians-read
sudo chown -R "$USER":"$USER" /opt/apollonians-read
cd /opt/apollonians-read
git clone https://github.com/revisispace/apollonians-read.git .
python3 -m venv .venv
.venv/bin/pip install -r services/edge-tts/requirements.txt
sudo cp services/edge-tts/apollonians-edge-tts.service /etc/systemd/system/
sudo cp services/edge-tts/.env.example /etc/apollonians-read/edge-tts.env
sudo chmod 600 /etc/apollonians-read/edge-tts.env
```

Edit `/etc/apollonians-read/edge-tts.env`:

```dotenv
SUPABASE_URL=https://PROJECT_ID.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_EXAMPLE
ALLOWED_ORIGINS=https://apollonians.duckdns.org,https://revisispace.github.io,http://localhost:3000
MAX_TEXT_LENGTH=4000
PREVIEW_TEXT_LIMIT=300
JOB_TTL_SECONDS=900
```

Aktifkan service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now apollonians-edge-tts
sudo systemctl status apollonians-edge-tts
curl http://127.0.0.1:8000/api/health
```

Reverse proxy HTTPS harus meneruskan domain publik ke `127.0.0.1:8000`. Jangan membuka port Uvicorn langsung ke internet.

## Endpoint Edge TTS

| Method | Endpoint | Login |
|---|---|---|
| `GET` | `/api/health` | Tidak |
| `GET` | `/api/voices` | Ya |
| `POST` | `/api/tts/preview` | Ya |
| `POST` | `/api/tts/generate` | Ya |
| `GET` | `/api/jobs/{id}` | Ya |
| `GET` | `/api/jobs/{id}/audio` | Ya |
| `DELETE` | `/api/jobs/{id}` | Ya |

Semua endpoint selain health memverifikasi bearer token Supabase. Job hanya dapat dibaca oleh pemiliknya.

## Deployment frontend

GitHub Actions menggunakan:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_EDGE_TTS_ENDPOINT` opsional; bila kosong memakai `https://apollonians.duckdns.org`.

Setiap push ke `main` menjalankan dependency install, lint, test, TypeScript, static production build, lalu deployment. Artifact tidak dipublikasikan jika quality gate gagal.

## Superadmin

Setelah akun admin terdaftar, jalankan melalui Supabase SQL Editor:

```sql
select public.promote_superadmin('email-admin@contoh.com');
```

Keluar lalu masuk kembali. Role tidak dapat dipromosikan dari JavaScript browser.

## Struktur utama

- `app/components/EdgeStudioView.tsx` — Studio Edge TTS dan fallback Piper.
- `app/lib/edge-tts.ts` — client Edge TTS terautentikasi.
- `app/lib/local-db.ts` — IndexedDB yang dipisahkan per akun.
- `app/lib/account-storage.ts` — playback, preferensi, dan aktivitas per akun.
- `services/edge-tts` — service Oracle VM.
- `supabase/schema.sql` — schema untuk instalasi baru.
- `supabase/migrations/20260805_edge_tts.sql` — migrasi instalasi lama.
- `.github/workflows` — CI dan deployment.

## Batasan

- Edge TTS bergantung pada layanan online pihak ketiga dan dapat berubah tanpa pemberitahuan.
- Piper dipertahankan sebagai fallback agar aplikasi tetap berguna saat service online tidak tersedia.
- URL sumber hanya dapat diproses bila server sumber mengizinkan CORS.
- MOBI dan buku dengan DRM belum didukung.
- Metadata dapat tersinkron antardevice, tetapi audio lokal tidak otomatis ikut tersinkron.
- Gunakan hanya konten yang kamu tulis, beli, atau memiliki izin untuk diproses.

Lisensi komponen utama dicatat di `THIRD_PARTY_NOTICES.md`.
