"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Clock3,
  FileAudio,
  FileText,
  Globe2,
  Headphones,
  Link2,
  LockKeyhole,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  WandSparkles,
  XCircle,
} from "lucide-react";
import { type Book } from "../lib/content";
import { parseBookFile, parseBookUrl, textChunks } from "../lib/document-parser";
import { saveLocalBook, saveAudioChunks, appendAudioChunk, listLocalBooks, getLocalBook } from "../lib/local-db";
import { generateIndonesianAudio } from "../lib/piper";
import { generateQwenAudio, isQwenConfigured } from "../lib/qwen";
import { getAppSettings } from "../lib/admin";
import { finishUsage, reserveUsage } from "../lib/usage";
import { BookCover } from "./BookCover";
import { getQuotaInfo, type QuotaInfo } from "../lib/usage";

type ChangeView = (view: "home" | "library" | "studio" | "activity" | "settings") => void;

export function HomeView({ allBooks = [], onChange, onSelect }: { allBooks: Book[]; onChange: ChangeView; onSelect: (book: Book) => void }) {
  const featured = allBooks[0] ?? null;
  const continueBooks = allBooks.slice(1, 4);
  const today = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" }).toUpperCase();
  const doneCount = allBooks.filter((b) => b.generated || b.progress === 100).length;
  return (
    <div className="view home-view">
      <div className="welcome-row">
        <div><p className="eyebrow">{today}</p><h1>Selamat datang kembali, Nabila.</h1><p>{allBooks.length ? "Lanjutkan cerita yang sempat tertunda." : "Saatnya mengubah bacaan menjadi pengalaman."}</p></div>
        <button className="primary-button" onClick={() => onChange("studio")}><Plus size={18} /> Buat audiobook</button>
      </div>
      {!featured ? (
        <section className="empty-state"><BookOpen size={30} /><h3>Belum ada audiobook</h3><p>Buat audiobook pertamamu dari tautan atau file buku — gratis dan privat.</p><button className="primary-button" onClick={() => onChange("studio")}>Buat sekarang</button></section>
      ) : (
        <section className="hero-listening">
          <div className="hero-cover-wrap"><BookCover {...featured} large /></div>
          <div className="hero-copy">
            <span className="soft-label"><span className="pulse-dot" /> {featured.generated ? "AUDIO SIAP" : "SEDANG DIDENGARKAN"}</span>
            <h2>{featured.title}</h2>
            <p>{featured.author}</p>
            <div className="chapter-row"><span>{featured.generated ? "Audiobook selesai" : `Progres ${featured.progress}%`}</span><span>{featured.remaining}</span></div>
            <div className="large-progress"><span style={{ width: `${featured.generated ? 100 : featured.progress}%` }} /></div>
            <small>Durasi ± {featured.duration}</small>
            <div className="hero-actions">
              <button className="dark-button" onClick={() => onSelect(featured)}><Play size={17} fill="currentColor" />{featured.generated ? "Dengarkan" : "Lanjutkan"}</button>
            </div>
          </div>
          <div className="hero-quote"><span>“</span><p>We’re here because we’re here because we’re here.</p><small>— John Green</small></div>
        </section>
      )}
      {continueBooks.length > 0 && (
        <section className="section-block">
          <div className="section-heading"><div><p className="eyebrow">KEMBALI MENDENGARKAN</p><h2>Lanjutkan ceritamu</h2></div><button onClick={() => onChange("library")}>Lihat semua <ArrowRight size={16} /></button></div>
          <div className="continue-grid">
            {continueBooks.map((book) => (
              <button className="continue-card" key={book.id} onClick={() => onSelect(book)}>
                <BookCover {...book} />
                <span className="continue-info"><strong>{book.title}</strong><small>{book.author}</small><span className="mini-progress"><i style={{ width: `${book.generated ? 100 : book.progress}%` }} /></span><small>{book.remaining}</small></span>
                <span className="card-play"><Play size={15} fill="currentColor" /></span>
              </button>
            ))}
          </div>
        </section>
      )}
      <div className="lower-grid">
        <section className="insight-card">
          <div><p className="eyebrow">KOLEKSIMU</p><h2>{allBooks.length}</h2><span>{doneCount} audiobook selesai</span></div>
          <button className="dark-button" onClick={() => onChange("library")}>Buka perpustakaan <ArrowRight size={16} /></button>
        </section>
        <section className="tip-card"><span className="tip-icon"><Sparkles size={19} /></span><div><p className="eyebrow">TIPS MENDENGARKAN</p><h3>Atur preferensi audiomu</h3><p>Normalisasi volume dan unduhan otomatis bisa diatur di Pengaturan.</p><button onClick={() => onChange("settings")}>Buka pengaturan <ArrowRight size={15} /></button></div></section>
      </div>
    </div>
  );
}

export function LibraryView({ allBooks, query, onChange, onSelect, onRename, onDelete }: { allBooks: Book[]; query: string; onChange: ChangeView; onSelect: (book: Book) => void; onRename: (book: Book, title: string) => Promise<void>; onDelete: (book: Book) => Promise<void> }) {
  const [filter, setFilter] = useState("Semua buku");
  const [sort, setSort] = useState("Terbaru");
  const [editing, setEditing] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [message, setMessage] = useState("");
  let visibleBooks = allBooks.filter((book) => {
    const matchesSearch = `${book.title} ${book.author} ${book.category}`.toLowerCase().includes(query.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === "Sedang dibaca") return book.progress > 0 && book.progress < 100;
    if (filter === "Selesai") return book.progress === 100 || book.generated;
    if (filter === "Belum dimulai") return book.progress === 0 && !book.generated;
    return true;
  });
  if (sort === "Judul A-Z") visibleBooks = [...visibleBooks].sort((a, b) => a.title.localeCompare(b.title));
  else if (sort === "Progres") visibleBooks = [...visibleBooks].sort((a, b) => (b.generated ? 100 : b.progress) - (a.generated ? 100 : a.progress));
  else visibleBooks = [...visibleBooks].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  return (
    <div className="view library-view">
      <div className="page-title-row"><div><p className="eyebrow">KOLEKSI PRIBADI</p><h1>Perpustakaan</h1><p>{allBooks.length ? `${visibleBooks.length} dari ${allBooks.length} buku ditampilkan.` : "Semua cerita yang siap menemani harimu."}</p></div><button className="primary-button" onClick={() => onChange("studio")}><Plus size={18} /> Tambah buku</button></div>
      <div className="filter-row">
        {["Semua buku", "Sedang dibaca", "Selesai", "Belum dimulai"].map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}
        <select className="sort-button" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Urutkan buku">
          <option>Terbaru</option>
          <option>Judul A-Z</option>
          <option>Progres</option>
        </select>
      </div>
      <div className="library-grid">
        {visibleBooks.map((book) => (
          <article className="library-card" key={book.id}>
            <button className="library-cover-button" onClick={() => onSelect(book)} aria-label={`Putar ${book.title}`}><BookCover {...book} /><span><Play size={19} fill="currentColor" /></span></button>
            <div className="library-meta"><p>{book.localOnly ? "LOKAL · " : ""}{book.category}</p>{editing === book.id ? <form className="title-editor" onSubmit={async (event) => { event.preventDefault(); const title = draftTitle.trim(); if (!title) return; try { await onRename(book, title); setEditing(null); setMessage("Judul berhasil diubah."); } catch (error) { setMessage(error instanceof Error ? error.message : "Judul gagal diubah."); } }}><input maxLength={300} autoFocus value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} aria-label="Judul baru" /><button>Simpan</button><button type="button" onClick={() => setEditing(null)}>Batal</button></form> : <h3>{book.title}</h3>}<span>{book.author}</span><div className="book-meta-row"><small><Headphones size={13} />{book.duration}</small><small>{book.generated ? "Audio siap" : `${book.progress}%`}</small></div><div className="mini-progress"><i style={{ width: `${book.generated ? 100 : book.progress}%` }} /></div>{!book.id.startsWith("demo-") && <div className="book-actions"><button onClick={() => { setEditing(book.id); setDraftTitle(book.title); }}><Pencil size={13} /> Ubah judul</button><button className="delete-book" onClick={async () => { if (!window.confirm(`Hapus “${book.title}” beserta audio lokalnya?`)) return; try { await onDelete(book); setMessage("Buku berhasil dihapus."); } catch (error) { setMessage(error instanceof Error ? error.message : "Buku gagal dihapus."); } }}><Trash2 size={13} /> Hapus</button></div>}</div>
          </article>
        ))}
      </div>
      {!visibleBooks.length && <div className="empty-state"><BookOpen size={30} /><h3>Buku tidak ditemukan</h3><p>{allBooks.length ? "Coba kata kunci atau filter lain." : "Perpustakaanmu masih kosong — buat audiobook pertamamu."}</p>{!allBooks.length && <button className="primary-button" onClick={() => onChange("studio")}>Buat audiobook</button>}</div>}
      {message && <p className="catalog-message">{message}</p>}
    </div>
  );
}

type CreateMode = "link" | "file";

const formatCharacters = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}rb`;
  return String(n);
};

export function StudioView({ onCreated }: { onCreated: (book: Book) => void | Promise<void> }) {
  const [mode, setMode] = useState<CreateMode>("link");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [voice, setVoice] = useState("Piper News ID");
  const [quality, setQuality] = useState("Cuplikan cepat");
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const accepted = ".pdf,.epub,.docx,.txt,.md";
  const [qwenEnabled, setQwenEnabled] = useState(false);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);

  useEffect(() => {
    getQuotaInfo().then(setQuota).catch(() => setQuota(null));
  }, []);

  useEffect(() => {
    getAppSettings().then((settings) => setQwenEnabled(settings.qwen_enabled && isQwenConfigured)).catch(() => setQwenEnabled(false));
  }, []);

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

      const sourceKey = mode === "file" && file ? file.name : url.trim();
      const existingBooks = await listLocalBooks();
      const existingAsset = existingBooks.find((item) => item.book.sourceName === sourceKey || item.book.sourceName === parsed.sourceName);
      const id = existingAsset ? existingAsset.id : crypto.randomUUID();
      const existingChunks = existingAsset?.audioChunks ?? [];
      const isResuming = existingChunks.length > 0;

      const book: Book = existingAsset
        ? existingAsset.book
        : {
            id,
            title: parsed.title,
            author: parsed.author,
            category: "Buku pribadi",
            duration: minutes >= 60 ? `${Math.floor(minutes / 60)}j ${minutes % 60}m` : `${minutes}m`,
            remaining: "Belum dimulai",
            progress: 0,
            palette: ["ochre", "coral", "navy", "sage", "plum"][Date.now() % 5],
            sourceName: sourceKey,
            createdAt: new Date().toISOString(),
            localOnly: true,
            generated: false,
          };

      if (!existingAsset) {
        await saveLocalBook({ id, book, text: parsed.text, source: file ?? undefined, audioChunks: [], updatedAt: book.createdAt! });
        await onCreated(book);
      }

      setMessage(isResuming ? `Melanjutkan dari part ${existingChunks.length + 1}… Pertahankan tab tetap terbuka.` : "Mengunduh model suara open-source dan membuat audio. Pertahankan tab ini tetap terbuka…");

      const maximumChunks = quality === "Cuplikan cepat" ? 4 : quality === "Bab awal" ? 24 : Number.POSITIVE_INFINITY;
      const reportProgress = (value: { phase: "model" | "audio"; completed: number; total: number }) => {
        if (value.phase === "model") {
          const percent = value.total ? Math.round((value.completed / value.total) * 35) : 10;
          setProgress(Math.max(5, percent));
        } else {
          setProgress(35 + Math.round((value.completed / value.total) * 65));
          setMessage(`Membuat bagian audio ${value.completed} dari ${value.total}…`);
        }
      };

      const result = voice === "Qwen3-TTS (eksperimental)"
        ? await generateQwenAudio(
            parsed.text,
            reportProgress,
            maximumChunks,
            id,
            existingChunks.length,
            async (newBlob) => {
              await appendAudioChunk(id, newBlob);
            },
          )
        : await generateIndonesianAudio(parsed.text, reportProgress, maximumChunks);

      if (voice === "Qwen3-TTS (eksperimental)") {
        const finalAsset = await getLocalBook(id);
        if (finalAsset) {
          finalAsset.book.generated = finalAsset.audioChunks.length > 0;
          finalAsset.updatedAt = new Date().toISOString();
          await saveLocalBook(finalAsset);
          await onCreated(finalAsset.book);
        }
      } else {
        const saved = await saveAudioChunks(id, result.chunks);
        const processedCharacters = textChunks(parsed.text).slice(0, maximumChunks).reduce((total, chunk) => total + chunk.length, 0);
        const reservation = await reserveUsage(processedCharacters, "piper", id).catch(() => null);
        await finishUsage(reservation?.id ?? null, true).catch(() => undefined);
        await onCreated(saved.book);
      }

      setProgress(100);
      setStatus("done");
      setMessage(result.truncated
        ? "Cuplikan audio tersimpan lokal. Pilih mode Buku penuh untuk mengonversi seluruh teks."
        : "Audiobook selesai dan tersimpan privat di perangkat ini.");
    } catch (error) {
      setStatus("error");
      setMessage(`${error instanceof Error ? error.message : "Buku gagal diproses."} Part yang sudah selesai tetap tersimpan — klik lagi untuk melanjutkan.`);
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
              <input ref={inputRef} type="file" accept={accepted} hidden onChange={(event) => handleFile(event.target?.files?.[0])} />
              {file ? <><span className="upload-icon"><FileText size={25} /></span><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(1)} MB · Siap diproses lokal</small><span className="change-file">Ganti file</span></> : <><span className="upload-icon"><UploadCloud size={25} /></span><strong>Letakkan file buku di sini</strong><small>atau klik untuk memilih dari perangkat</small><span className="file-types">PDF · EPUB · DOCX · TXT · MD &nbsp; Maks. 50 MB</span></>}
            </button>
          )}
          <div className="step-heading second"><span>02</span><div><h3>Atur suara</h3><p>Sesuaikan karakter narasi dengan jenis bacaan.</p></div></div>
          <div className="setting-grid">
            <label>Mesin audio<select value={voice} onChange={(event) => setVoice(event.target.value)}><option>Piper News ID</option><option disabled={!qwenEnabled}>Qwen3-TTS (eksperimental)</option></select></label>
            <label>Bahasa<select value={voice === "Qwen3-TTS (eksperimental)" ? "English" : "Bahasa Indonesia"} disabled><option>{voice === "Qwen3-TTS (eksperimental)" ? "English" : "Bahasa Indonesia"}</option></select></label>
            <label>Mode proses<select value={quality} onChange={(event) => setQuality(event.target.value)}><option>Cuplikan cepat</option><option>Bab awal</option><option>Buku penuh</option></select></label>
          </div>
          <div className="estimate-row"><Clock3 size={17} /><span>Diproses {voice === "Qwen3-TTS (eksperimental)" ? "di worker privat" : "di perangkat"}</span><strong>{quality === "Buku penuh" ? "Tergantung panjang buku" : quality === "Bab awal" ? "± 5–20 menit" : "± 1–5 menit"}</strong></div>
          {status === "working" && <div className="conversion-progress" aria-label={`Progres ${progress}%`}><span style={{ width: `${progress}%` }} /></div>}
          {status !== "idle" && <div className={`status-message ${status}`}>
            {status === "working" && <RefreshCw size={18} className="spin" />}
            {status === "done" && <CheckCircle2 size={18} />}
            {status === "error" && <XCircle size={18} />}
            <span>{message}</span>
          </div>}
          {quota && voice === "Qwen3-TTS (eksperimental)" && (
            <div className="quota-indicator" aria-label="Sisa kuota harian">
              <div className="quota-head">
                <span>Kuota harian ({voice === "Qwen3-TTS (eksperimental)" ? "server" : "lokal"})</span>
                <strong>{formatCharacters(quota.remaining)} / {formatCharacters(quota.dailyLimit)} tersisa</strong>
              </div>
              <div className="quota-track"><span style={{ width: `${Math.min(100, quota.percentUsed)}%` }} /></div>
            </div>
          )}
          <button className="generate-button" disabled={status === "working"} onClick={createAudiobook}><WandSparkles size={19} />{status === "working" ? "Menyiapkan buku…" : "Buat audiobook"}<ArrowRight size={18} /></button>
          <p className="secure-note"><LockKeyhole size={14} />{voice === "Piper News ID" ? "Piper Bahasa Indonesia berjalan lokal. Teks tidak dikirim ke penyedia AI." : "Narator English (Ryan) melalui worker privat Oracle Cloud dengan kuota."}</p>
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
      <div className="page-title-row"><div><p className="eyebrow">RIWAYAT PROSES</p><h1>Aktivitas</h1><p>Buku yang berhasil kamu proses tercatat di sini.</p></div></div>
      {recent.length === 0 ? (
        <div className="empty-state"><FileAudio size={30} /><h3>Belum ada aktivitas</h3><p>Audiobook yang kamu buat akan muncul di sini.</p></div>
      ) : (
        <section className="activity-list">
          <div className="activity-list-heading"><h3>Semua aktivitas</h3></div>
          {recent.map((title, index) => (
            <article key={`${title}-${index}`}>
              <span className="activity-state"><Check size={18} /></span>
              <div><h4>{title}</h4><p>Audio selesai dibuat</p></div>
              <time>Baru saja</time>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

type Prefs = { autoDownload: boolean; normalize: boolean; notify: boolean };
export function SettingsView() {
  const [prefs, setPrefs] = useState<Prefs>(() => {
    const defaultPrefs: Prefs = { autoDownload: false, normalize: true, notify: true };
    if (typeof window === "undefined") return defaultPrefs;
    try {
      const raw = localStorage.getItem("apollonians-prefs");
      if (raw) return { ...defaultPrefs, ...(JSON.parse(raw) as Partial<Prefs>) };
    } catch { /* abaikan */ }
    return defaultPrefs;
  });
  
  const [previewState, setPreviewState] = useState<"idle" | "loading" | "playing" | "error">("idle");

  const update = (key: "autoDownload" | "normalize" | "notify", value: boolean) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem("apollonians-prefs", JSON.stringify(next)); } catch { /* abaikan */ }
      return next;
    });
  };

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
      <div className="page-title-row"><div><p className="eyebrow">PREFERENSI</p><h1>Pengaturan</h1><p>Perubahan tersimpan otomatis di perangkat ini.</p></div></div>
      <div className="settings-layout">
        <section className="settings-panel">
          <div className="settings-section">
            <div className="settings-section-head">
              <div>
                <h3>Piper Bahasa Indonesia</h3>
                <p>Model open-source berjalan lokal. Unduhan pertama sekitar 63 MB.</p>
              </div>
              <button className="preview-button" onClick={previewVoice}>
                {previewState === "loading" ? <RefreshCw className="spin" size={16} /> : previewState === "playing" ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
                {previewState === "playing" ? "Jeda" : "Dengar contoh"}
              </button>
            </div>
            {previewState === "error" && <p className="inline-warning">Model gagal dimuat. Pastikan memakai Chrome/Edge terbaru dan koneksi internet tersedia saat unduhan pertama.</p>}
            <audio id="piper-preview" hidden />
            <div className="voice-options">
              <button className="active">
                <span className="voice-wave">▂▅▃▂</span>
                <strong>News TTS ID</strong>
                <small>Piper · ONNX lokal</small>
                <CheckCircle2 size={17} />
              </button>
            </div>
          </div>
          <div className="settings-section">
            <h3>Pemutaran & hasil</h3>
            <ToggleRow title="Normalisasi volume" copy="Seimbangkan volume antar bab secara otomatis." enabled={prefs.normalize} onChange={(v) => update("normalize", v)} />
            <ToggleRow title="Unduh otomatis" copy="Simpan audio baru untuk didengarkan offline." enabled={prefs.autoDownload} onChange={(v) => update("autoDownload", v)} />
            <ToggleRow title="Notifikasi selesai" copy="Beri tahu ketika audiobook siap didengar." enabled={prefs.notify} onChange={(v) => update("notify", v)} />
          </div>
        </section>
      </div>
    </div>
  );
}

function ToggleRow({ title, copy, enabled, onChange }: { title: string; copy: string; enabled: boolean; onChange: (value: boolean) => void }) {
  return <div className="toggle-row"><div><strong>{title}</strong><p>{copy}</p></div><button className={`toggle ${enabled ? "on" : ""}`} onClick={() => onChange(!enabled)} aria-label={`${title}: ${enabled ? "aktif" : "nonaktif"}`}><span /></button></div>;
}