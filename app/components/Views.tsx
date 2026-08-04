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
import { BookCover } from "./BookCover";

type ChangeView = (view: "home" | "library" | "studio" | "activity" | "settings") => void;

export function HomeView({ onChange, onSelect }: { onChange: ChangeView; onSelect: (book: Book) => void }) {
  return (
    <div className="view home-view">
      <div className="welcome-row">
        <div><p className="eyebrow">SELASA, 4 AGUSTUS</p><h1>Selamat datang kembali, Nabila.</h1><p>Lanjutkan cerita yang sempat tertunda.</p></div>
        <button className="primary-button" onClick={() => onChange("studio")}><Plus size={18} /> Buat audiobook</button>
      </div>

      <section className="hero-listening">
        <div className="hero-cover-wrap"><BookCover {...books[0]} large /></div>
        <div className="hero-copy">
          <span className="soft-label"><span className="pulse-dot" /> SEDANG DIDENGARKAN</span>
          <h2>{books[0].title}</h2>
          <p>{books[0].author}</p>
          <div className="chapter-row"><span>Bab 7 dari 12</span><span>64% selesai</span></div>
          <div className="large-progress"><span /></div>
          <small>2 jam 58 menit tersisa</small>
          <div className="hero-actions">
            <button className="dark-button" onClick={() => onSelect(books[0])}><Play size={17} fill="currentColor" /> Lanjutkan</button>
            <button className="round-button" aria-label="Opsi buku"><MoreHorizontal size={19} /></button>
          </div>
        </div>
        <div className="hero-quote"><span>“</span><p>We’re here because we’re here because we’re here.</p><small>— John Green</small></div>
      </section>

      <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow">KEMBALI MENDENGARKAN</p><h2>Lanjutkan ceritamu</h2></div><button onClick={() => onChange("library")}>Lihat semua <ArrowRight size={16} /></button></div>
        <div className="continue-grid">
          {books.slice(1, 4).map((book) => (
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

export function LibraryView({ query, onChange, onSelect }: { query: string; onChange: ChangeView; onSelect: (book: Book) => void }) {
  const [filter, setFilter] = useState("Semua buku");
  const visibleBooks = books.filter((book) => `${book.title} ${book.author} ${book.category}`.toLowerCase().includes(query.toLowerCase()));
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
            <div className="library-meta"><p>{book.category}</p><h3>{book.title}</h3><span>{book.author}</span><div className="book-meta-row"><small><Headphones size={13} /> {book.duration}</small><small>{book.progress}%</small></div><div className="mini-progress"><i style={{ width: `${book.progress}%` }} /></div></div>
          </article>
        ))}
      </div>
      {!visibleBooks.length && <div className="empty-state"><BookOpen size={30} /><h3>Buku tidak ditemukan</h3><p>Coba kata kunci lain atau tambahkan buku baru.</p></div>}
    </div>
  );
}

type CreateMode = "link" | "file";

export function StudioView({ onCreated }: { onCreated: () => void }) {
  const [mode, setMode] = useState<CreateMode>("link");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [voice, setVoice] = useState("Nova");
  const [language, setLanguage] = useState("Bahasa Indonesia");
  const [quality, setQuality] = useState("Seimbang");
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const accepted = ".pdf,.epub,.mobi,.docx,.txt,.md";

  const handleFile = (incoming?: File) => {
    if (!incoming) return;
    const extension = `.${incoming.name.split(".").pop()?.toLowerCase()}`;
    const allowed = accepted.split(",");
    if (!allowed.includes(extension) || incoming.size > 50 * 1024 * 1024) {
      setStatus("error");
      setMessage("Gunakan PDF, EPUB, MOBI, DOCX, TXT, atau MD berukuran maksimal 50 MB.");
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
    setMessage("Membaca struktur buku dan menyiapkan setiap bab…");
    window.setTimeout(() => {
      setStatus("done");
      setMessage("Buku berhasil masuk antrean. Kamu bebas meninggalkan halaman ini.");
      onCreated();
    }, 1400);
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
              {file ? <><span className="upload-icon"><FileText size={25} /></span><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(1)} MB · Siap diunggah</small><span className="change-file">Ganti file</span></> : <><span className="upload-icon"><UploadCloud size={25} /></span><strong>Letakkan file buku di sini</strong><small>atau klik untuk memilih dari perangkat</small><span className="file-types">PDF · EPUB · MOBI · DOCX · TXT · MD &nbsp; Maks. 50 MB</span></>}
            </button>
          )}

          <div className="step-heading second"><span>02</span><div><h3>Atur suara</h3><p>Sesuaikan karakter narasi dengan jenis bacaan.</p></div></div>
          <div className="setting-grid">
            <label>Suara narator<select value={voice} onChange={(event) => setVoice(event.target.value)}><option>Nova</option><option>Alloy</option><option>Coral</option><option>Onyx</option><option>Sage</option></select></label>
            <label>Bahasa<select value={language} onChange={(event) => setLanguage(event.target.value)}><option>Bahasa Indonesia</option><option>English</option><option>Bahasa Melayu</option></select></label>
            <label>Kualitas<select value={quality} onChange={(event) => setQuality(event.target.value)}><option>Seimbang</option><option>Ekspresif</option><option>Hemat data</option></select></label>
          </div>
          <div className="estimate-row"><Clock3 size={17} /><span>Estimasi proses</span><strong>± 12–18 menit</strong></div>
          {status !== "idle" && <div className={`status-message ${status}`}>
            {status === "working" && <RefreshCw size={18} className="spin" />}
            {status === "done" && <CheckCircle2 size={18} />}
            {status === "error" && <XCircle size={18} />}
            <span>{message}</span>
          </div>}
          <button className="generate-button" disabled={status === "working"} onClick={createAudiobook}><WandSparkles size={19} /> {status === "working" ? "Menyiapkan buku…" : "Buat audiobook"}<ArrowRight size={18} /></button>
          <p className="secure-note"><LockKeyhole size={14} /> Suara dihasilkan AI. Secret tetap di server dan tidak pernah dikirim ke browser.</p>
        </section>

        <aside className="studio-aside">
          <div className="how-card"><p className="eyebrow">CARA KERJA</p>{[[FileText, "Baca & susun", "Teks dibersihkan dan dibagi per bab."], [Sparkles, "Narasi natural", "Jeda, intonasi, dan ritme disesuaikan."], [FileAudio, "Siap didengar", "Putar langsung atau unduh per bab."]].map(([Icon, title, copy], index) => { const IconComponent = Icon as typeof FileText; return <div className="how-row" key={String(title)}><span><IconComponent size={18} /></span><div><small>0{index + 1}</small><h4>{String(title)}</h4><p>{String(copy)}</p></div></div>; })}</div>
          <div className="copyright-card"><ShieldCheck size={21} /><div><h4>Hak cipta tetap milikmu</h4><p>Gunakan hanya buku yang kamu beli, tulis, atau punya izin untuk mengonversinya.</p></div></div>
        </aside>
      </div>
    </div>
  );
}

export function ActivityView() {
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
        {activities.map((item) => <article key={`${item.title}-${item.time}`}><span className={`activity-state ${item.state === "Diproses" ? "processing" : item.state === "Perlu dicek" ? "warning" : ""}`}>{item.state === "Diproses" ? <RefreshCw size={18} className="spin" /> : item.state === "Perlu dicek" ? <XCircle size={18} /> : <Check size={18} />}</span><div><h4>{item.title}</h4><p>{item.detail}</p></div><time>{item.time}</time><button aria-label="Opsi aktivitas"><MoreHorizontal size={18} /></button></article>)}
      </section>
    </div>
  );
}

export function SettingsView() {
  const [autoDownload, setAutoDownload] = useState(false);
  const [normalize, setNormalize] = useState(true);
  const [notify, setNotify] = useState(true);
  const [previewState, setPreviewState] = useState<"idle" | "loading" | "playing" | "error">("idle");

  const previewVoice = () => {
    if (!("speechSynthesis" in window)) { setPreviewState("error"); return; }
    if (previewState === "playing") {
      window.speechSynthesis.cancel();
      setPreviewState("idle");
      return;
    }
    setPreviewState("loading");
    const utterance = new SpeechSynthesisUtterance("Halo, ini adalah contoh suara narator untuk Apollonians Read. Buku apa pun, kini bisa kamu dengarkan.");
    utterance.lang = "id-ID";
    utterance.rate = 0.95;
    const indonesianVoice = window.speechSynthesis.getVoices().find((item) => item.lang.toLowerCase().startsWith("id"));
    if (indonesianVoice) utterance.voice = indonesianVoice;
    utterance.onstart = () => setPreviewState("playing");
    utterance.onend = () => setPreviewState("idle");
    utterance.onerror = () => setPreviewState("error");
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="view settings-view">
      <div className="page-title-row"><div><p className="eyebrow">PREFERENSI</p><h1>Pengaturan</h1><p>Atur pengalaman membaca dan privasimu.</p></div></div>
      <div className="settings-layout">
        <aside className="settings-menu"><button className="active"><Settings2 size={17} /> Audio & narasi</button><button><Download size={17} /> Unduhan</button><button><ShieldCheck size={17} /> Privasi & keamanan</button></aside>
        <section className="settings-panel">
          <div className="settings-section"><div className="settings-section-head"><div><h3>Suara perangkat</h3><p>Menggunakan suara yang tersedia di browser pengguna.</p></div><button className="preview-button" onClick={previewVoice}>{previewState === "loading" ? <RefreshCw className="spin" size={16} /> : previewState === "playing" ? <Pause size={16} /> : <Play size={16} fill="currentColor" />} {previewState === "playing" ? "Jeda" : "Dengar contoh"}</button></div>{previewState === "error" && <p className="inline-warning">Browser ini belum menyediakan suara Bahasa Indonesia.</p>}<div className="voice-options">{["Natural", "Tenang", "Ekspresif", "Dalam"].map((item, index) => <button key={item} className={index === 0 ? "active" : ""}><span className="voice-wave">▂▅▃▆▂</span><strong>{item}</strong><small>{["Suara sistem", "Kecepatan 0.9×", "Kecepatan 1.05×", "Nada rendah"][index]}</small>{index === 0 && <CheckCircle2 size={17} />}</button>)}</div></div>
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
