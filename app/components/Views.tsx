"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  Download,
  FileAudio,
  Headphones,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { Book } from "../lib/content";
import { exportBookAudio } from "../lib/audio-export";
import { PLAYBACK_POSITION_EVENT, readPlaybackPosition } from "../lib/account-storage";
import { listLocalBooks } from "../lib/local-db";
import { BookCover } from "./BookCover";

type ChangeView = (view: "home" | "library" | "studio" | "activity" | "settings") => void;

const statusForProgress = (progress: number) => progress >= 100 ? "Selesai" : progress > 0 ? "Sedang dibaca" : "Belum dimulai";

export function HomeView({
  allBooks = [],
  onChange,
  onSelect,
}: {
  allBooks: Book[];
  onChange: ChangeView;
  onSelect: (book: Book) => void;
}) {
  const featured = allBooks[0] ?? null;
  const continueBooks = allBooks.filter((book) => book.progress > 0 && book.progress < 100).slice(0, 3);
  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).toUpperCase();
  const doneCount = allBooks.filter((book) => book.progress >= 100).length;

  return (
    <div className="view home-view">
      <div className="welcome-row">
        <div>
          <p className="eyebrow">{today}</p>
          <h1>Selamat datang kembali.</h1>
          <p>{allBooks.length ? "Lanjutkan cerita yang sempat tertunda." : "Saatnya mengubah bacaan menjadi pengalaman."}</p>
        </div>
        <button className="primary-button" onClick={() => onChange("studio")}>
          <Plus size={18} /> Buat audiobook
        </button>
      </div>

      {!featured ? (
        <section className="empty-state">
          <BookOpen size={30} />
          <h3>Belum ada audiobook</h3>
          <p>Buat audiobook pertamamu dari tautan atau file buku.</p>
          <button className="primary-button" onClick={() => onChange("studio")}>Buat sekarang</button>
        </section>
      ) : (
        <section className="hero-listening">
          <div className="hero-cover-wrap"><BookCover {...featured} large /></div>
          <div className="hero-copy">
            <span className="soft-label"><span className="pulse-dot" /> {featured.generated ? "AUDIO SIAP" : "AUDIO BELUM SIAP"}</span>
            <h2>{featured.title}</h2>
            <p>{featured.author}</p>
            <div className="chapter-row"><span>{statusForProgress(featured.progress)}</span><span>{featured.remaining}</span></div>
            <div className="large-progress"><span style={{ width: `${featured.progress}%` }} /></div>
            <small>Durasi ± {featured.duration}</small>
            <div className="hero-actions">
              <button className="dark-button" onClick={() => onSelect(featured)}>
                <Play size={17} fill="currentColor" /> {featured.progress > 0 ? "Lanjutkan" : "Mulai dengarkan"}
              </button>
            </div>
          </div>
          <div className="hero-quote"><span>“</span><p>Bacaan yang baik layak didengar dengan nyaman.</p><small>— Apollonians Read</small></div>
        </section>
      )}

      {continueBooks.length > 0 && (
        <section className="section-block">
          <div className="section-heading">
            <div><p className="eyebrow">KEMBALI MENDENGARKAN</p><h2>Lanjutkan ceritamu</h2></div>
            <button onClick={() => onChange("library")}>Lihat semua <ArrowRight size={16} /></button>
          </div>
          <div className="continue-grid">
            {continueBooks.map((book) => (
              <button className="continue-card" key={book.id} onClick={() => onSelect(book)}>
                <BookCover {...book} />
                <span className="continue-info">
                  <strong>{book.title}</strong><small>{book.author}</small>
                  <span className="mini-progress"><i style={{ width: `${book.progress}%` }} /></span>
                  <small>{book.remaining}</small>
                </span>
                <span className="card-play"><Play size={15} fill="currentColor" /></span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="lower-grid">
        <section className="insight-card">
          <div><p className="eyebrow">KOLEKSI</p><h2>{allBooks.length}</h2><span>{doneCount} buku selesai didengarkan</span></div>
          <button className="dark-button" onClick={() => onChange("library")}>Buka perpustakaan <ArrowRight size={16} /></button>
        </section>
        <section className="tip-card">
          <span className="tip-icon"><Sparkles size={19} /></span>
          <div><p className="eyebrow">TIPS</p><h3>Atur preferensi audiomu</h3><p>Normalisasi volume dan unduhan otomatis tersedia di Pengaturan.</p><button onClick={() => onChange("settings")}>Buka pengaturan <ArrowRight size={15} /></button></div>
        </section>
      </div>
    </div>
  );
}

export function LibraryView({
  allBooks,
  query,
  onChange,
  onSelect,
  onRename,
  onDelete,
}: {
  allBooks: Book[];
  query: string;
  onChange: ChangeView;
  onSelect: (book: Book) => void;
  onRename: (book: Book, title: string) => Promise<void>;
  onDelete: (book: Book) => Promise<void>;
}) {
  const [filter, setFilter] = useState("Semua buku");
  const [sort, setSort] = useState("Terbaru");
  const [editing, setEditing] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [message, setMessage] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);
  const [localProgress, setLocalProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    let active = true;
    const refreshProgress = async () => {
      try {
        const assets = await listLocalBooks();
        if (!active) return;
        const next: Record<string, number> = {};
        for (const asset of assets) {
          const position = readPlaybackPosition(asset.userId, asset.id);
          const total = asset.audioChunks.length;
          if (!position || !total) {
            next[asset.id] = 0;
            continue;
          }
          const chunkProgress = Math.max(0, Math.min(total, position.chunk + (position.currentTime > 0 ? 0.5 : 0)));
          next[asset.id] = Math.min(99, Math.max(1, Math.round((chunkProgress / total) * 100)));
        }
        setLocalProgress(next);
      } catch {
        // Metadata progress remains as a fallback when local assets are unavailable.
      }
    };

    void refreshProgress();
    const handleProgress = () => void refreshProgress();
    window.addEventListener(PLAYBACK_POSITION_EVENT, handleProgress);
    window.addEventListener("focus", handleProgress);
    return () => {
      active = false;
      window.removeEventListener(PLAYBACK_POSITION_EVENT, handleProgress);
      window.removeEventListener("focus", handleProgress);
    };
  }, []);

  const booksWithProgress = useMemo(() => allBooks.map((book) => {
    const progress = Object.prototype.hasOwnProperty.call(localProgress, book.id) ? localProgress[book.id] : book.progress;
    return {
      ...book,
      progress,
      remaining: progress >= 100 ? "Selesai" : progress > 0 ? `${100 - progress}% tersisa` : "Belum dimulai",
    };
  }), [allBooks, localProgress]);

  let visibleBooks = booksWithProgress.filter((book) => {
    const matchesSearch = `${book.title} ${book.author} ${book.category}`.toLowerCase().includes(query.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === "Sedang dibaca") return book.progress > 0 && book.progress < 100;
    if (filter === "Selesai") return book.progress >= 100;
    if (filter === "Belum dimulai") return book.progress === 0;
    return true;
  });

  if (sort === "Judul A-Z") visibleBooks = [...visibleBooks].sort((a, b) => a.title.localeCompare(b.title));
  else if (sort === "Progres") visibleBooks = [...visibleBooks].sort((a, b) => b.progress - a.progress);
  else visibleBooks = [...visibleBooks].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  const downloadAudio = async (book: Book) => {
    setExporting(book.id);
    setMessage("");
    try {
      const parts = await exportBookAudio(book);
      setMessage(`${parts} bagian audio berhasil diekspor sebagai ZIP.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Audio gagal diekspor.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="view library-view">
      <div className="page-title-row">
        <div><p className="eyebrow">KOLEKSI PRIBADI</p><h1>Perpustakaan</h1><p>{allBooks.length ? `${visibleBooks.length} dari ${allBooks.length} buku ditampilkan.` : "Semua cerita yang siap menemani harimu."}</p></div>
        <button className="primary-button" onClick={() => onChange("studio")}><Plus size={18} /> Tambah buku</button>
      </div>

      <div className="filter-row">
        {["Semua buku", "Sedang dibaca", "Selesai", "Belum dimulai"].map((item) => (
          <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>
        ))}
        <select className="sort-button" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Urutkan buku">
          <option>Terbaru</option><option>Judul A-Z</option><option>Progres</option>
        </select>
      </div>

      <div className="library-grid">
        {visibleBooks.map((book) => (
          <article className="library-card" key={book.id}>
            <button className="library-cover-button" onClick={() => onSelect(book)} aria-label={`Putar ${book.title}`}>
              <BookCover {...book} /><span><Play size={19} fill="currentColor" /></span>
            </button>
            <div className="library-meta">
              <p>{book.localOnly ? "LOKAL · " : ""}{book.category}</p>
              {editing === book.id ? (
                <form className="title-editor" onSubmit={async (event) => {
                  event.preventDefault();
                  const title = draftTitle.trim();
                  if (!title) return;
                  try {
                    await onRename(book, title);
                    setEditing(null);
                    setMessage("Judul berhasil diubah.");
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "Judul gagal diubah.");
                  }
                }}>
                  <input maxLength={300} autoFocus value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} aria-label="Judul baru" />
                  <button>Simpan</button><button type="button" onClick={() => setEditing(null)}>Batal</button>
                </form>
              ) : <h3>{book.title}</h3>}
              <span>{book.author}</span>
              <div className="book-meta-row"><small><Headphones size={13} />{book.duration}</small><small>{statusForProgress(book.progress)} · {book.progress}%</small></div>
              <div className="mini-progress"><i style={{ width: `${book.progress}%` }} /></div>
              {!book.id.startsWith("demo-") && (
                <div className="book-actions">
                  <button onClick={() => { setEditing(book.id); setDraftTitle(book.title); }}><Pencil size={13} /> Ubah judul</button>
                  <button disabled={!book.generated || exporting === book.id} onClick={() => downloadAudio(book)}>
                    <Download size={13} /> {exporting === book.id ? "Mengekspor…" : "Unduh audio"}
                  </button>
                  <button className="delete-book" onClick={async () => {
                    if (!window.confirm(`Hapus “${book.title}” beserta audio lokalnya?`)) return;
                    try { await onDelete(book); setMessage("Buku berhasil dihapus."); }
                    catch (error) { setMessage(error instanceof Error ? error.message : "Buku gagal dihapus."); }
                  }}><Trash2 size={13} /> Hapus</button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      {!visibleBooks.length && (
        <div className="empty-state">
          <BookOpen size={30} /><h3>Buku tidak ditemukan</h3>
          <p>{allBooks.length ? "Coba kata kunci atau filter lain." : "Perpustakaanmu masih kosong."}</p>
          {!allBooks.length && <button className="primary-button" onClick={() => onChange("studio")}>Buat audiobook</button>}
        </div>
      )}
      {message && <p className="catalog-message">{message}</p>}
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
