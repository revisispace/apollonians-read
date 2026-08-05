# Third-party notices

Komponen utama yang digunakan Apollonians Read:

| Komponen | Lisensi | Kegunaan |
|---|---|---|
| React | MIT | Antarmuka pengguna |
| Next.js | MIT | Build dan static export |
| Supabase JavaScript | MIT | Autentikasi dan sinkronisasi metadata |
| edge-tts | LGPL-3.0 | Client tidak resmi untuk layanan suara online Microsoft Edge |
| FastAPI | MIT | API gateway Edge TTS pada Oracle VM |
| Uvicorn | BSD-3-Clause | ASGI server |
| HTTPX | BSD-3-Clause | Verifikasi Supabase dan pemanggilan HTTP backend |
| Piper TTS Web | MIT | Inferensi TTS fallback di browser |
| ONNX Runtime Web | MIT | Runtime model neural lokal |
| idb | ISC | Wrapper IndexedDB |
| JSZip | MIT atau GPL-3.0-or-later | Pembacaan EPUB |
| Mammoth | BSD-2-Clause | Pembacaan DOCX |
| PDF.js | Apache-2.0 | Pembacaan PDF |

Model suara Piper `id_ID-news_tts-medium` diambil saat runtime dari repositori `rhasspy/piper-voices`, yang ditandai MIT pada halaman repositorinya. Periksa model card upstream sebelum penggunaan komersial atau redistribusi model.

`edge-tts` bukan SDK resmi Microsoft. Library tersebut mengakses layanan suara online Microsoft Edge dan dapat terdampak perubahan protokol, kebijakan, ketersediaan, atau pembatasan layanan pihak ketiga. Apollonians Read mempertahankan Piper sebagai fallback lokal.

Tidak ada kode atau model Qwen yang digunakan oleh versi aplikasi saat ini.
