"use client";

import { useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  FileAudio,
  FileText,
  Globe2,
  Headphones,
  Link2,
  LockKeyhole,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  WandSparkles,
  XCircle,
} from "lucide-react";
import { activities, books, type Book } from "../lib/content";
import { parseBookFile, parseBookUrl } from "../lib/document-parser";
import { saveLocalBook, saveAudioChunks } from "../lib/local-db";
import { generateIndonesianAudio } from "../lib/piper";
import { BookCover } from "./BookCover";

type ChangeView = (view: "home" | "library" | "studio" | "activity" | "settings") => void;

export function HomeView({ allBooks, onChange, onSelect }: { allBooks: Book[]; onChange: ChangeView; onSelect: (book: Book) => void }) {
  const featured = allBooks[0] ?? books[0];
  const continueBooks = allBooks.slice(1, 4);
  return (
    <div className="view home-view">
      <div className="welcome-row">
        <div><p className="eyebrow">SELASA, 4 AGUSTUS</p><h1>Selamat datang kembali, Nabila.</h1><p>Lanjutkan cerita yang sempat tertunda.</p></div>
        <button className="primary-button" onClick={() => onChange("studio")}><Plus size={18} /> Buat audiobook</button>
      </div>

      <section className="hero-listening">
        <div className="hero-cover-wrap"><BookCover {...featured} large /></div>
        <div className="hero-copy">
          <span className="soft-label"><span className="pulse-dot" /> SEDANG DIDENGARKAN</span>
          <h2>{featured.title}</h2>
          <p>{featured.author}</p>
          <div className="chapter-row"><span>Bab 7 dari 12</span><span>64% selesai</span></div>
          <div className="large-progress"><span /></div>
          <small>2 jam 58 menit tersisa</small>
          <div className="hero-actions">
            <button className="dark-button" onClick={() => onSelect(featured)}><Play size={17} fill="currentColor" /> {featured.generated ? "Dengarkan" : "Lanjutkan"}</button>
            <button className="round-button" aria-label="Opsi buku"><MoreHorizontal size={19} /></button>
          </div>
        </div>
        <div className="hero-quote"><span>“</span><p>We’re here because we’re here because we’re here.</p><small>— John Green</small></div>
      </section>

      <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow">KEMBALI MENDENGARKAN</p><h2>Lanjutkan ceritamu</h2></div><button onClick={() => onChange("library")}>Lihat semua <ArrowRight size={16} /></button></div>
        <div className="continue-grid">
          {continueBooks.map((book) => (
            <button className="continue-card" key={book.id} onClick={() => onSelect(book)}>
              <BookCover {...book} />
              <span className="continue-info"><strong>{book.title}</strong><small>{book.author}</small><span className="mini-progress"><i style={{ width: `${book.progress}%` }} /></span><small>{book.remaining}</small></span>
              <span className="card-play"><Play size={15} fill="currentColor" /></span>
            </button>
          ))}
        </div>
      </section>

      <div className="lower-grid">
        <section className="insight-card">
          <div><p className="eyebrow">RINGKASAN MINGGU INI</p><h2>4j 32m</h2><span>+18% dari minggu lalu</span></div>
          <div className="bar-chart" aria-label="Grafik waktu dengar mingguan">
            {[35, 58, 42, 79, 53, 88, 64].map((height, index) => <span key={index} style={{ height: `${height}%` }} className={index === 5 ? "peak" : ""}><i>{["S", "S", "R", "K", "J", "S", "M"][index]}</i></span>)}
          </div>
        </section>
        <section className="tip-card"><span className="tip-icon"><Sparkles size={19} /></span><div><p className="eyebrow">TIPS MENDENGARKAN</p><h3>Atur sleep timer sebelum tidur</h3><p>Audio akan berhenti otomatis tanpa kehilangan posisi terakhir.</p><button>Atur sekarang <ArrowRight size={15} /></button></div></section>
      </div>
    </div>
  );
}

export function LibraryView({ allBooks, query, onChange, onSelect }: { allBooks: Book[]; query: string; onChange: ChangeView; onSelect: (book: Book) => void }) {
  const [filter, setFilter] = useState("Semua buku");
  const visibleBooks = allBooks.filter((book) => {
    const matchesSearch = `${book.title} ${book.author} ${book.category}`.toLowerCase().includes(query.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === "Sedang dibaca") return book.progress > 0 && book.progress < 100;
    if (filter === "Selesai") return book.progress === 100;
    if (filter === "Belum dimulai") return book.progress === 0;
    return true;
  });
  return (
    <div className="view library-view">
      <div className="page-title-row"><div><p className="eyebrow">KOLEKSI PRIBADI</p><h1>Perpustakaan</h1><p>Semua cerita yang siap menemani harimu.</p></div><button className="primary-button" onClick={() => onChange("studio")}><Plus size={18} /> Tambah buku</button></div>
      <div className="filter-row">
        {["Semua buku", "Sedang dibaca", "Selesai", "Belum dimulai"].map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}
        <button className="sort-button">Terbaru <ChevronDown size={15} /></button>
      </div>
      <div className="library-grid">
        {visibleBooks.map((book) => (
          <article className="library-card" key={book.id}>
            <button className="library-cover-button" onClick={() => onSelect(book)} aria-label={`Putar ${book.title}`}><BookCover {...book} /><span><Play size={19} fill="currentColor" /></span></button>
            <div className="library-meta"><p>{book.localOnly ? "LOKAL · " : ""}{book.category}</p><h3>{book.title}</h3><span>{book.author}</span><div className="book-meta-row"><small><Headphones size={13} /> {book.duration}</small><small>{book.generated ? "Audio siap" : `${book.progress}%`}</small></div><div className="mini-progress"><i style={{ width: `${book.generated ? 100 : book.progress}%` }} /></div></div>
          </article>
        ))}
      </div>
      {!visibleBooks.length && <div className="empty-state"><BookOpen size={30} /><h3>Buku tidak ditemukan</h3><p>Coba kata kunci lain atau tambahkan buku baru.</p></div>}
    </div>
  );
}

type CreateMode = "link" | "file";

export function StudioView({ onCreated }: { onCreated: (book: Book) => void | Promise<void> }) {
  const [mode, setMode] = useState<CreateMode>("link");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [voice, setVoice] = useState("Piper News ID");
  const [language, setLanguage] = useState("Bahasa Indonesia");
  const [quality, setQuality] = useState("Cuplikan cepat");
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const accepted = ".pdf,.epub,.docx,.txt,.md";

  const handleFile = (incoming?: File) => {
    if (!incoming) return;
    const extension = `.${incoming.name.split(".").pop()?.toLowerCase()}`;
    const allowed = accepted.split(",");
    if (!allowed.includes(extension) || incoming.size > 50 * 1024 * 1024) {
      setStatus("error");
      setMessage("Gunakan PDF, EPUB, DOCX, TXT, atau MD berukuran maksimal 50 MB.");
      return;
    }
    setFile(incoming);
    setStatus("idle");
  };

  const createAudiobook = async () => {
    if ((mode === "link" && !url.trim()) || (mode === "file" && !file)) {
      setStatus("error");
      setMessage(mode === "link" ? "Masukkan tautan buku terlebih dahulu." : "Pilih file buku terlebih dahulu.");
      return;
    }
    if (mode === "link") {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:") throw new Error();
      } catch {
        setStatus("error");
        setMessage("Masukkan tautan HTTPS yang valid.");
        return;
      }
    }
    setStatus("working");
    setProgress(2);
    setMessage("Membaca dan membersihkan teks buku…");
    try {
      const parsed = mode === "file" && file ? await parseBookFile(file) : await parseBookUrl(url.trim());
      const wordCount = parsed.text.split(/\s+/).length;
      const minutes = Math.max(1, Math.ceil(wordCount / 155));
      const id = crypto.randomUUID();
      const book: Book = {
        id,
        title: parsed.title,
        author: parsed.author,
        category: "Buku pribadi",
        duration: minutes >= 60 ? `${Math.floor(minutes / 60)}j ${minutes % 60}m` : `${minutes}m`,
        remaining: "Belum dimulai",
        progress: 0,
        palette: ["ochre", "coral", "navy", "sage", "plum"][Date.now() % 5],
        sourceName: parsed.sourceName,
        createdAt: new Date().toISOString(),
        localOnly: true,
        generated: false,
      };
      await saveLocalBook({ id, book, text: parsed.text, source: file ?? undefined, audioChunks: [], updatedAt: book.createdAt! });
      await onCreated(book);
      setMessage("Mengunduh model suara open-source dan membuat audio. Pertahankan tab ini tetap terbuka…");
      const maximumChunks = quality === "Cuplikan cepat" ? 4 : quality === "Bab awal" ? 24 : Number.POSITIVE_INFINITY;
      const result = await generateIndonesianAudio(parsed.text, (value) => {
        if (value.phase === "model") {
          const percent = value.total ? Math.round((value.completed / value.total) * 35) : 10;
          setProgress(Math.max(5, percent));
        } else {
          setProgress(35 + Math.round((value.completed / value.total) * 65));
          setMessage(`Membuat bagian audio ${value.completed} dari ${value.total}…`);
        }
      }, maximumChunks);
      const saved = await saveAudioChunks(id, result.chunks);
      setProgress(100);
      setStatus("done");
      setMessage(result.truncated
        ? "Cuplikan audio tersimpan lokal. Pilih mode Buku penuh untuk mengonversi seluruh teks."
        : "Audiobook selesai dan tersimpan privat di perangkat ini.");
      await onCreated(saved.book);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Buku gagal diproses.");
    }
  };

  return (
    <div className="view studio-view">
      <div className="studio-intro"><p className="eyebrow">STUDIO AUDIO</p><h1>Ubah bacaan menjadi <em>pengalaman.</em></h1><p>Tempel tautan atau unggah file buku. Kami akan memisahkan bab, merapikan teks, lalu membuat audio yang nyaman didengar.</p></div>
      <div className="studio-layout">
        <section className="creator-card">
          <div className="step-heading"><span>01</span><div><h3>Pilih sumber buku</h3><p>Pastikan kamu memiliki izin untuk memproses kontennya.</p></div></div>
          <div className="source-tabs">
            <button className={mode === "link" ? "active" : ""} onClick={() => setMode("link")}><Link2 size={18} /> Dari tautan</button>
            <button className={mode === "file" ? "active" : ""} onClick={() => setMode("file")}><UploadCloud size={18} /> Unggah file</button>
          </div>
          {mode === "link" ? (
            <div className="url-panel"><Globe2 size={21} /><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://contoh.com/buku-atau-artikel" /><span>HTTPS</span></div>
          ) : (
            <button className={`drop-zone${file ? " has-file" : ""}`} onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); handleFile(event.dataTransfer.files[0]); }}>
              <input ref={inputRef} type="file" accept={accepted} hidden onChange={(event) => handleFile(event.target.files?.[0])} />
              {file ? <><span className="upload-icon"><FileText size={25} /></span><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(1)} MB · Siap diproses lokal</small><span className="change-file">Ganti file</span></> : <><span className="upload-icon"><UploadCloud size={25} /></span><strong>Letakkan file buku di sini</strong><small>atau klik untuk memilih dari perangkat</small><span className="file-types">PDF · EPUB · DOCX · TXT · MD &nbsp; Maks. 50 MB</span></>}
            </button>
          )}

          <div className="step-heading second"><span>02</span><div><h3>Atur suara</h3><p>Sesuaikan karakter narasi dengan jenis bacaan.</p></div></div>
          <div className="setting-grid">
            <label>Suara narator<select value={voice} onChange={(event) => setVoice(event.target.value)}><option>Piper News ID</option></select></label>
            <label>Bahasa<select value={language} onChange={(event) => setLanguage(event.target.value)}><option>Bahasa Indonesia</option></select></label>
            <label>Mode proses<select value={quality} onChange={(event) => setQuality(event.target.value)}><option>Cuplikan cepat</option><option>Bab awal</option><option>Buku penuh</option></select></label>
          </div>
          <div className="estimate-row"><Clock3 size={17} /><span>Diproses di perangkat</span><strong>{quality === "Buku penuh" ? "Tergantung panjang buku" : quality === "Bab awal" ? "± 5–20 menit" : "± 1–5 menit"}</strong></div>
          {status === "working" && <div className="conversion-progress" aria-label={`Progres ${progress}%`}><span style={{ width: `${progress}%` }} /></div>}
          {status !== "idle" && <div className={`status-message ${status}`}>
            {status === "working" && <RefreshCw size={18} className="spin" />}
            {status === "done" && <CheckCircle2 size={18} />}
            {status === "error" && <XCircle size={18} />}
            <span>{message}</span>
          </div>}
          <button className="generate-button" disabled={status === "working"} onClick={createAudiobook}><WandSparkles size={19} /> {status === "working" ? "Menyiapkan buku…" : "Buat audiobook"}<ArrowRight size={18} /></button>
          <p className="secure-note"><LockKeyhole size={14} /> Piper berjalan lokal. Tidak ada teks buku atau API key yang dikirim ke penyedia AI.</p>
        </section>

        <aside className="studio-aside">
          <div className="how-card"><p className="eyebrow">CARA KERJA</p>{[[FileText, "Baca & susun", "Teks dibersihkan dan dibagi per bab."], [Sparkles, "Narasi natural", "Jeda, intonasi, dan ritme disesuaikan."], [FileAudio, "Siap didengar", "Putar langsung atau unduh per bab."]].map(([Icon, title, copy], index) => { const IconComponent = Icon as typeof FileText; return <div className="how-row" key={String(title)}><span><IconComponent size={18} /></span><div><small>0{index + 1}</small><h4>{String(title)}</h4><p>{String(copy)}</p></div></div>; })}</div>
          <div className="copyright-card"><ShieldCheck size={21} /><div><h4>Hak cipta tetap milikmu</h4><p>Gunakan hanya buku yang kamu beli, tulis, atau punya izin untuk mengonversinya.</p></div></div>
        </aside>
      </div>
    </div>
  );
}

export function ActivityView({ recent = [] }: { recent?: string[] }) {
  return (
    <div className="view activity-view">
      <div className="page-title-row"><div><p className="eyebrow">RIWAYAT PROSES</p><h1>Aktivitas</h1><p>Pantau buku yang sedang dibuat dan riwayat konversimu.</p></div></div>
      <section className="activity-summary">
        <div><FileAudio size={20} /><span><strong>24</strong><small>Audiobook dibuat</small></span></div>
        <div><Clock3 size={20} /><span><strong>98j</strong><small>Total durasi</small></span></div>
        <div><CheckCircle2 size={20} /><span><strong>96%</strong><small>Proses berhasil</small></span></div>
      </section>
      <section className="activity-list">
        <div className="activity-list-heading"><h3>Semua aktivitas</h3><button>30 hari terakhir <ChevronDown size={15} /></button></div>
        {[...recent.map((title) => ({ title, detail: "Audio lokal selesai dibuat", time: "Baru saja", state: "Selesai" })), ...activities].map((item, index) => <article key={`${item.title}-${item.time}-${index}`}><span className={`activity-state ${item.state === "Diproses" ? "processing" : item.state === "Perlu dicek" ? "warning" : ""}`}>{item.state === "Diproses" ? <RefreshCw size={18} className="spin" /> : item.state === "Perlu dicek" ? <XCircle size={18} /> : <Check size={18} />}</span><div><h4>{item.title}</h4><p>{item.detail}</p></div><time>{item.time}</time><button aria-label="Opsi aktivitas"><MoreHorizontal size={18} /></button></article>)}
      </section>
    </div>
  );
}

export function SettingsView() {
  const [autoDownload, setAutoDownload] = useState(false);
  const [normalize, setNormalize] = useState(true);
  const [notify, setNotify] = useState(true);
  const [previewState, setPreviewState] = useState<"idle" | "loading" | "playing" | "error">("idle");

  const previewVoice = async () => {
    if (previewState === "playing") {
      document.querySelector<HTMLAudioElement>("#piper-preview")?.pause();
      setPreviewState("idle");
      return;
    }
    setPreviewState("loading");
    try {
      const result = await generateIndonesianAudio("Halo, ini adalah contoh suara narator open-source untuk Apollonians Read.", undefined, 1);
      const audio = document.querySelector<HTMLAudioElement>("#piper-preview");
      if (!audio) throw new Error();
      audio.src = URL.createObjectURL(result.chunks[0]);
      audio.onplay = () => setPreviewState("playing");
      audio.onended = () => setPreviewState("idle");
      audio.onerror = () => setPreviewState("error");
      await audio.play();
    } catch {
      setPreviewState("error");
    }
  };

  return (
    <div className="view settings-view">
      <div className="page-title-row"><div><p className="eyebrow">PREFERENSI</p><h1>Pengaturan</h1><p>Atur pengalaman membaca dan privasimu.</p></div></div>
      <div className="settings-layout">
        <aside className="settings-menu"><button className="active"><Settings2 size={17} /> Audio & narasi</button><button><Download size={17} /> Unduhan</button><button><ShieldCheck size={17} /> Privasi & keamanan</button></aside>
        <section className="settings-panel">
          <div className="settings-section"><div className="settings-section-head"><div><h3>Piper Bahasa Indonesia</h3><p>Model open-source berjalan lokal. Unduhan pertama sekitar 63 MB.</p></div><button className="preview-button" onClick={previewVoice}>{previewState === "loading" ? <RefreshCw className="spin" size={16} /> : previewState === "playing" ? <Pause size={16} /> : <Play size={16} fill="currentColor" />} {previewState === "playing" ? "Jeda" : "Dengar contoh"}</button></div>{previewState === "error" && <p className="inline-warning">Model gagal dimuat. Pastikan memakai Chrome/Edge terbaru dan koneksi internet tersedia saat unduhan pertama.</p>}<audio id="piper-preview" hidden /><div className="voice-options"><button className="active"><span className="voice-wave">▂▅▃▆▂</span><strong>News TTS ID</strong><small>Piper · ONNX lokal</small><CheckCircle2 size={17} /></button></div></div>
          <div className="settings-section"><h3>Pemutaran & hasil</h3><ToggleRow title="Normalisasi volume" copy="Seimbangkan volume antar bab secara otomatis." enabled={normalize} onChange={setNormalize} /><ToggleRow title="Unduh otomatis" copy="Simpan audio baru untuk didengarkan offline." enabled={autoDownload} onChange={setAutoDownload} /><ToggleRow title="Notifikasi selesai" copy="Beri tahu ketika audiobook siap didengar." enabled={notify} onChange={setNotify} /></div>
          <div className="settings-footer"><button className="dark-button">Simpan perubahan</button></div>
        </section>
      </div>
    </div>
  );
}

function ToggleRow({ title, copy, enabled, onChange }: { title: string; copy: string; enabled: boolean; onChange: (value: boolean) => void }) {
  return <div className="toggle-row"><div><strong>{title}</strong><p>{copy}</p></div><button className={`toggle ${enabled ? "on" : ""}`} onClick={() => onChange(!enabled)} aria-label={`${title}: ${enabled ? "aktif" : "nonaktif"}`}><span /></button></div>;
}
