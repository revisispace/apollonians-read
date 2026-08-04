# Third-party notices

Komponen utama yang digunakan aplikasi ini:

| Komponen | Lisensi | Kegunaan |
|---|---|---|
| React | MIT | Antarmuka pengguna |
| Next.js | MIT | Build dan static export |
| Supabase JavaScript | MIT | Auth dan sinkronisasi metadata opsional |
| Piper TTS Web | MIT | Inferensi TTS di browser |
| Qwen3-TTS | Apache-2.0 | TTS opsional pada worker mandiri |
| ONNX Runtime Web | MIT | Runtime model neural lokal |
| idb | ISC | Wrapper IndexedDB |
| JSZip | MIT atau GPL-3.0-or-later | Pembacaan EPUB |
| Mammoth | BSD-2-Clause | Pembacaan DOCX |
| PDF.js | Apache-2.0 | Pembacaan PDF |

Model suara `id_ID-news_tts-medium` diambil saat runtime dari repositori
[`rhasspy/piper-voices`](https://huggingface.co/rhasspy/piper-voices), yang ditandai
MIT pada halaman repositorinya. Model card menyebut data pelatihan secara terpisah;
periksa model card upstream sebelum penggunaan komersial atau redistribusi model.

Kode dan model Qwen3-TTS tersedia dari
[`QwenLM/Qwen3-TTS`](https://github.com/QwenLM/Qwen3-TTS) dengan lisensi
Apache-2.0. Model resmi saat ini tidak mencantumkan Bahasa Indonesia sebagai
bahasa yang didukung; penggunaan teks Indonesia di aplikasi bersifat eksperimental.
