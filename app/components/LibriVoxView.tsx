"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Headphones,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Search,
  SkipBack,
  SkipForward,
} from "lucide-react";
import {
  getLibriVoxBook,
  isLibriVoxBookSaved,
  prefetchLibriVoxBook,
  removeSavedLibriVoxBook,
  saveLibriVoxBook,
  searchLibriVoxBooks,
  type LibriVoxBook,
  type LibriVoxSearchField,
} from "../lib/librivox";
import {
  readAudioBookmarks,
  readPlaybackPosition,
  writeAudioBookmarks,
  writePlaybackPosition,
  type AudioBookmark,
  type PlaybackPosition,
} from "../lib/account-storage";

const PAGE_SIZE = 8;
const MIN_QUERY_LENGTH = 3;
const formatTime = (seconds: number) => Number.isFinite(seconds)
  ? `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`
  : "0:00";

type AudioState = "idle" | "loading" | "ready" | "buffering" | "error";

type CatalogCardProps = {
  book: LibriVoxBook;
  onOpen: (book: LibriVoxBook, autoplay?: boolean) => void;
};

function CatalogCard({ book, onOpen }: CatalogCardProps) {
  const prefetch = () => { void prefetchLibriVoxBook(book.id); };
  return (
    <article className="librivox-card" onPointerEnter={prefetch}>
      <button className="librivox-card-main" onClick={() => onOpen(book)} onFocus={prefetch}>
        <div className="librivox-cover">
          {book.thumbnailUrl
            ? <img src={book.thumbnailUrl} alt="" loading="lazy" />
            : <BookOpenText size={38} />}
        </div>
        <div>
          <small>{book.language} · {book.sectionCount || "?"} bagian</small>
          <strong>{book.title}</strong>
          <span>{book.author}</span>
          <p>{book.totalTime || "Durasi belum tersedia"}</p>
        </div>
      </button>
      <div className="librivox-card-actions">
        <button onClick={() => onOpen(book)}>Lihat detail</button>
        <button className="play" onClick={() => onOpen(book, true)}>
          <Play size={16} fill="currentColor" /> Putar audiobook
        </button>
      </div>
    </article>
  );
}

export function LibriVoxView({ userId }: { userId: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const searchControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const detailRequestIdRef = useRef(0);
  const pendingAutoplayRef = useRef(false);
  const resumePositionRef = useRef<PlaybackPosition | null>(null);

  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [field, setField] = useState<LibriVoxSearchField>("title");
  const [submittedField, setSubmittedField] = useState<LibriVoxSearchField>("title");
  const [page, setPage] = useState(0);
  const [books, setBooks] = useState<LibriVoxBook[]>([]);
  const [selected, setSelected] = useState<LibriVoxBook | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [section, setSection] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [saved, setSaved] = useState(false);
  const [bookmarks, setBookmarks] = useState<AudioBookmark[]>([]);
  const [audioState, setAudioState] = useState<AudioState>("idle");
  const [autoplayPending, setAutoplayPending] = useState(false);
  const [playerMessage, setPlayerMessage] = useState("");

  const storageId = selected ? `librivox-${selected.id}` : "";
  const activeSection = selected?.sections[section];
  const hasSearched = Boolean(submittedQuery);

  const loadCatalog = useCallback(async () => {
    if (!submittedQuery) return;
    searchControllerRef.current?.abort();
    const controller = new AbortController();
    searchControllerRef.current = controller;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");
    setBooks([]);

    try {
      const result = await searchLibriVoxBooks({
        query: submittedQuery,
        field: submittedField,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        signal: controller.signal,
      });
      if (requestId === requestIdRef.current) setBooks(result);
    } catch (problem) {
      if (controller.signal.aborted) return;
      if (requestId === requestIdRef.current) {
        setBooks([]);
        setError(problem instanceof Error ? problem.message : "Katalog LibriVox gagal dimuat.");
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [page, submittedField, submittedQuery]);

  useEffect(() => {
    if (!submittedQuery) return;
    const timer = window.setTimeout(() => { void loadCatalog(); }, 0);
    return () => {
      window.clearTimeout(timer);
      searchControllerRef.current?.abort();
    };
  }, [loadCatalog, submittedQuery]);

  useEffect(() => {
    if (!books.length) return;
    const timer = window.setTimeout(() => {
      books.slice(0, 2).forEach((book) => { void prefetchLibriVoxBook(book.id); });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [books]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !activeSection) return;
    audio.pause();
    audio.src = activeSection.audioUrl;
    audio.preload = "auto";
    audio.load();
  }, [activeSection]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    if (!storageId || !activeSection) return;
    const timer = window.setInterval(() => {
      const audio = audioRef.current;
      if (audio) {
        writePlaybackPosition(userId, storageId, {
          chunk: section,
          currentTime: audio.currentTime,
          updatedAt: Date.now(),
        });
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [activeSection, section, storageId, userId]);

  const clearStaleResults = (nextQuery: string, nextField: LibriVoxSearchField) => {
    if (!submittedQuery || (nextQuery.trim() === submittedQuery && nextField === submittedField)) return;
    searchControllerRef.current?.abort();
    requestIdRef.current += 1;
    setSubmittedQuery("");
    setBooks([]);
    setPage(0);
    setLoading(false);
    setError("");
  };

  const submitSearch = () => {
    const clean = query.trim();
    if (clean.length < MIN_QUERY_LENGTH) {
      setError(`Masukkan minimal ${MIN_QUERY_LENGTH} karakter agar pencarian tidak membebani katalog.`);
      return;
    }

    const repeatSearch = clean === submittedQuery && field === submittedField && page === 0;
    requestIdRef.current += 1;
    searchControllerRef.current?.abort();
    setError("");
    setBooks([]);
    setPage(0);
    setSubmittedField(field);
    setSubmittedQuery(clean);
    if (repeatSearch) void loadCatalog();
  };

  const openBook = async (book: LibriVoxBook, autoplay = false) => {
    const requestId = ++detailRequestIdRef.current;
    const localStorageId = `librivox-${book.id}`;
    const position = readPlaybackPosition(userId, localStorageId);

    pendingAutoplayRef.current = autoplay;
    resumePositionRef.current = position;
    setAutoplayPending(autoplay);
    setSelected(book);
    setSaved(isLibriVoxBookSaved(userId, book.id));
    setSection(position && position.chunk < Math.max(book.sectionCount, 1) ? position.chunk : 0);
    setElapsed(0);
    setDuration(0);
    setPlaying(false);
    setBookmarks(readAudioBookmarks(userId, localStorageId));
    setDetailLoading(!book.sections.length);
    setAudioState(book.sections.length ? "loading" : "idle");
    setPlayerMessage(autoplay ? "Menyiapkan audio pertama…" : "");
    setError("");

    try {
      const detail = book.sections.length ? book : await getLibriVoxBook(book.id);
      if (requestId !== detailRequestIdRef.current) return;
      if (!detail.sections.length) throw new Error("Rekaman ini belum menyediakan chapter audio yang dapat diputar.");
      const resumedSection = position && position.chunk < detail.sections.length ? position.chunk : 0;
      setSelected(detail);
      setSection(resumedSection);
      setSaved(isLibriVoxBookSaved(userId, detail.id));
      setDetailLoading(false);
      setAudioState("loading");
    } catch (problem) {
      if (requestId !== detailRequestIdRef.current) return;
      pendingAutoplayRef.current = false;
      setAutoplayPending(false);
      setDetailLoading(false);
      setAudioState("error");
      setPlayerMessage(problem instanceof Error ? problem.message : "Detail audiobook gagal dimuat.");
    }
  };

  const tryAutoplay = async () => {
    const audio = audioRef.current;
    if (!audio || !pendingAutoplayRef.current) return;
    pendingAutoplayRef.current = false;
    setAutoplayPending(false);
    try {
      await audio.play();
      setPlayerMessage("");
    } catch {
      setAudioState("ready");
      setPlayerMessage("Audio sudah siap. Tekan tombol putar untuk memulai.");
    }
  };

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio || !activeSection) return;
    pendingAutoplayRef.current = false;
    setAutoplayPending(false);
    if (playing) return void audio.pause();
    setPlayerMessage("");
    try {
      await audio.play();
    } catch {
      setAudioState("error");
      setPlayerMessage("Audio LibriVox tidak dapat diputar dari browser ini.");
    }
  };

  const seek = (delta: number) => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + delta));
  };

  const moveSection = (target: number, autoplay = playing) => {
    if (!selected || target < 0 || target >= selected.sections.length) return;
    pendingAutoplayRef.current = autoplay;
    resumePositionRef.current = null;
    setAutoplayPending(autoplay);
    setSection(target);
    setElapsed(0);
    setDuration(0);
    setAudioState("loading");
    setPlayerMessage(autoplay ? "Memuat bagian berikutnya…" : "");
  };

  const addBookmark = () => {
    if (!activeSection || !storageId) return;
    const next = [
      ...bookmarks,
      {
        id: crypto.randomUUID(),
        chunk: section,
        currentTime: elapsed,
        label: `${activeSection.title} · ${formatTime(elapsed)}`,
        createdAt: Date.now(),
      },
    ].sort((a, b) => a.chunk - b.chunk || a.currentTime - b.currentTime);
    setBookmarks(next);
    writeAudioBookmarks(userId, storageId, next);
  };

  const toggleSaved = () => {
    if (!selected) return;
    if (saved) removeSavedLibriVoxBook(userId, selected.id);
    else saveLibriVoxBook(userId, selected);
    setSaved(!saved);
  };

  const closeDetail = () => {
    detailRequestIdRef.current += 1;
    pendingAutoplayRef.current = false;
    setAutoplayPending(false);
    audioRef.current?.pause();
    setSelected(null);
    setAudioState("idle");
  };

  const readerNames = useMemo(
    () => activeSection?.readers.map((reader) => reader.name).join(", ") || "Pembaca LibriVox",
    [activeSection],
  );
  const audioStatus = detailLoading
    ? "Mengambil daftar chapter…"
    : audioState === "loading"
      ? "Menghubungkan audio…"
      : audioState === "buffering"
        ? "Buffering audio…"
        : audioState === "error"
          ? "Audio bermasalah"
          : audioState === "ready"
            ? "Audio siap"
            : "Pilih audiobook untuk mulai";

  return (
    <div className="view librivox-view">
      <audio
        ref={audioRef}
        preload="auto"
        onLoadStart={() => setAudioState("loading")}
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration);
          const position = resumePositionRef.current;
          if (position?.chunk === section && position.currentTime < event.currentTarget.duration) {
            event.currentTarget.currentTime = position.currentTime;
          }
          resumePositionRef.current = null;
        }}
        onCanPlay={() => { setAudioState("ready"); void tryAutoplay(); }}
        onPlaying={() => { setPlaying(true); setAudioState("ready"); setPlayerMessage(""); }}
        onPause={() => setPlaying(false)}
        onWaiting={() => setAudioState("buffering")}
        onStalled={() => setAudioState("buffering")}
        onTimeUpdate={(event) => setElapsed(event.currentTarget.currentTime)}
        onError={() => {
          pendingAutoplayRef.current = false;
          setAutoplayPending(false);
          setPlaying(false);
          setAudioState("error");
          setPlayerMessage("Sumber audio gagal dimuat. Coba bagian lain atau buka halaman LibriVox asli.");
        }}
        onEnded={() => moveSection(section + 1, true)}
      />

      <section className="librivox-hero">
        <div>
          <p className="eyebrow">AUDIOBOOK PUBLIC DOMAIN</p>
          <h1>Jelajahi <em>LibriVox.</em></h1>
          <p>Katalog hanya mengambil delapan hasil per halaman. Detail chapter dan audio baru dimuat ketika buku dipilih.</p>
        </div>
        <Headphones size={48} />
      </section>

      <form className="librivox-search" onSubmit={(event) => { event.preventDefault(); submitSearch(); }}>
        <Search size={19} />
        <input
          value={query}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            clearStaleResults(value, field);
          }}
          placeholder="Ketik minimal 3 karakter..."
        />
        <select
          value={field}
          onChange={(event) => {
            const value = event.target.value as LibriVoxSearchField;
            setField(value);
            clearStaleResults(query, value);
          }}
        >
          <option value="title">Judul</option>
          <option value="author">Penulis</option>
          <option value="genre">Genre</option>
        </select>
        <button disabled={loading}>{loading ? "Mencari…" : "Cari"}</button>
      </form>

      {error && <p className="librivox-error">{error}</p>}

      {!selected ? (
        <>
          {!hasSearched ? (
            <div className="librivox-empty">
              <Search size={34} />
              <strong>Cari audiobook LibriVox</strong>
              <p>Katalog baru dihubungi setelah kamu menekan Cari atau Enter, sehingga halaman tetap ringan.</p>
            </div>
          ) : loading ? (
            <div className="librivox-loading"><LoaderCircle className="spin" /> Mencari “{submittedQuery}”…</div>
          ) : books.length ? (
            <div className="librivox-grid">
              {books.map((book) => <CatalogCard key={book.id} book={book} onOpen={openBook} />)}
            </div>
          ) : (
            <div className="librivox-empty"><BookOpenText size={34} /><strong>Tidak ada hasil</strong><p>Coba kata kunci atau jenis pencarian lain.</p></div>
          )}

          {hasSearched && !loading && books.length > 0 && (
            <div className="librivox-pagination">
              <button disabled={!page} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft size={17} /> Sebelumnya</button>
              <span>Halaman {page + 1}</span>
              <button disabled={books.length < PAGE_SIZE} onClick={() => setPage((value) => value + 1)}>Berikutnya <ChevronRight size={17} /></button>
            </div>
          )}
        </>
      ) : (
        <section className="librivox-detail">
          <button className="librivox-back" onClick={closeDetail}>← Kembali ke hasil</button>
          <div className="librivox-detail-grid">
            <aside className="librivox-book-info">
              <div className="librivox-detail-cover">
                {selected.coverUrl || selected.thumbnailUrl
                  ? <img src={selected.coverUrl || selected.thumbnailUrl} alt={`Sampul ${selected.title}`} />
                  : <BookOpenText size={54} />}
              </div>
              <h2>{selected.title}</h2>
              <p>{selected.author}</p>
              <div className="librivox-meta"><span>{selected.language}</span><span>{selected.totalTime || `${selected.sectionCount} bagian`}</span></div>
              <button className="librivox-save" onClick={toggleSaved}><Bookmark size={17} fill={saved ? "currentColor" : "none"} />{saved ? "Tersimpan di perpustakaan" : "Simpan ke perpustakaan"}</button>
              <div className="librivox-links">
                {selected.librivoxUrl && <a href={selected.librivoxUrl} target="_blank" rel="noreferrer">Buka LibriVox <ExternalLink size={14} /></a>}
                {selected.archiveUrl && <a href={selected.archiveUrl} target="_blank" rel="noreferrer">Buka Internet Archive <ExternalLink size={14} /></a>}
              </div>
              <p className="librivox-description">{selected.description || "Deskripsi tidak tersedia."}</p>
            </aside>

            <div className="librivox-player-area">
              <div className="librivox-player-status" data-state={audioState}>
                {(detailLoading || audioState === "loading" || audioState === "buffering") && <LoaderCircle className="spin" size={15} />}
                <span>{audioStatus}</span>
              </div>
              <div className="librivox-now">
                <small>SEDANG DIPUTAR</small>
                <h3>{activeSection?.title ?? (detailLoading ? "Menyiapkan audiobook…" : "Chapter belum tersedia")}</h3>
                <p>{activeSection ? readerNames : selected.author}</p>
              </div>
              <div className="librivox-timeline">
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  step="0.1"
                  value={Math.min(elapsed, duration || 0)}
                  disabled={!activeSection}
                  onChange={(event) => { if (audioRef.current) audioRef.current.currentTime = Number(event.target.value); }}
                />
                <div><span>{formatTime(elapsed)}</span><span>{formatTime(duration)}</span></div>
              </div>
              <div className="librivox-controls">
                <button onClick={() => moveSection(section - 1)} disabled={!section || detailLoading}><SkipBack /></button>
                <button onClick={() => seek(-15)} disabled={!activeSection}><RotateCcw /><small>15</small></button>
                <button className="main" onClick={toggle} disabled={!activeSection || detailLoading}>
                  {detailLoading || (audioState === "loading" && autoplayPending)
                    ? <LoaderCircle className="spin" />
                    : playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
                </button>
                <button onClick={() => seek(30)} disabled={!activeSection}><RotateCw /><small>30</small></button>
                <button onClick={() => moveSection(section + 1)} disabled={detailLoading || !selected.sections.length || section + 1 >= selected.sections.length}><SkipForward /></button>
              </div>

              {playerMessage && <p className={`librivox-player-message ${audioState === "error" ? "error" : ""}`}>{playerMessage}</p>}

              <div className="librivox-tools">
                <button onClick={() => setSpeed(speed === 1 ? 1.25 : speed === 1.25 ? 1.5 : speed === 1.5 ? 2 : 1)}>{speed}× Kecepatan</button>
                <button onClick={addBookmark} disabled={!activeSection}><Bookmark size={16} /> Simpan bookmark</button>
              </div>

              <section className="librivox-source-panel">
                <div><FileText size={20} /><span><strong>Teks bacaan</strong><small>LibriVox tidak menyediakan subtitle atau timestamp sinkron.</small></span></div>
                {selected.textSourceUrl
                  ? <a href={selected.textSourceUrl} target="_blank" rel="noreferrer">Buka teks sumber <ExternalLink size={14} /></a>
                  : <span className="unavailable">Teks sumber tidak tersedia</span>}
              </section>

              {detailLoading ? (
                <div className="librivox-sections-loading"><LoaderCircle className="spin" /> Mengambil chapter audio…</div>
              ) : (
                <div className="librivox-sections">
                  <div className="head"><strong>Daftar bagian</strong><span>{selected.sections.length} bagian</span></div>
                  {selected.sections.map((item, index) => (
                    <button key={item.id} className={index === section ? "active" : ""} onClick={() => moveSection(index, playing)}>
                      <span><b>{index + 1}</b><span><strong>{item.title}</strong><small>{item.readers.map((reader) => reader.name).join(", ") || "LibriVox"}</small></span></span>
                      <time>{item.duration || formatTime(item.durationSeconds)}</time>
                    </button>
                  ))}
                </div>
              )}

              {bookmarks.length > 0 && (
                <div className="librivox-bookmarks">
                  <strong>Bookmark</strong>
                  {bookmarks.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        resumePositionRef.current = { chunk: item.chunk, currentTime: item.currentTime, updatedAt: Date.now() };
                        moveSection(item.chunk, false);
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
