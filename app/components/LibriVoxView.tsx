"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, BookOpenText, ChevronLeft, ChevronRight, ExternalLink, Headphones, LoaderCircle, Pause, Play, RotateCcw, RotateCw, Search, SkipBack, SkipForward } from "lucide-react";
import { getLibriVoxBook, isLibriVoxBookSaved, removeSavedLibriVoxBook, saveLibriVoxBook, searchLibriVoxBooks, type LibriVoxBook, type LibriVoxSearchField } from "../lib/librivox";
import { readAudioBookmarks, readPlaybackPosition, writeAudioBookmarks, writePlaybackPosition, type AudioBookmark } from "../lib/account-storage";

const PAGE_SIZE = 18;
const time = (seconds: number) => Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}` : "0:00";

export function LibriVoxView({ userId }: { userId: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [query, setQuery] = useState("");
  const [field, setField] = useState<LibriVoxSearchField>("title");
  const [page, setPage] = useState(0);
  const [books, setBooks] = useState<LibriVoxBook[]>([]);
  const [selected, setSelected] = useState<LibriVoxBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [section, setSection] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [saved, setSaved] = useState(false);
  const [bookmarks, setBookmarks] = useState<AudioBookmark[]>([]);
  const storageId = selected ? `librivox-${selected.id}` : "";
  const activeSection = selected?.sections[section];

  const loadCatalog = useCallback(async () => {
    setLoading(true); setError("");
    try { setBooks(await searchLibriVoxBooks({ query, field, limit: PAGE_SIZE, offset: page * PAGE_SIZE })); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "Katalog LibriVox gagal dimuat."); setBooks([]); }
    finally { setLoading(false); }
  }, [field, page, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadCatalog(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadCatalog]);

  const openBook = async (book: LibriVoxBook) => {
    setDetailLoading(true); setError("");
    try {
      const detail = book.sections.length ? book : await getLibriVoxBook(book.id);
      const position = readPlaybackPosition(userId, `librivox-${detail.id}`);
      setSelected(detail); setSaved(isLibriVoxBookSaved(userId, detail.id)); setSection(position && position.chunk < detail.sections.length ? position.chunk : 0);
      setElapsed(0); setDuration(0); setPlaying(false); setBookmarks(readAudioBookmarks(userId, `librivox-${detail.id}`));
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Detail audiobook gagal dimuat."); }
    finally { setDetailLoading(false); }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !activeSection) return;
    audio.pause(); audio.src = activeSection.audioUrl; audio.playbackRate = speed; audio.load();
    const position = storageId ? readPlaybackPosition(userId, storageId) : null;
    if (position?.chunk === section) audio.currentTime = position.currentTime;
  }, [activeSection, section, speed, storageId, userId]);

  useEffect(() => {
    if (!storageId || !activeSection) return;
    const timer = window.setInterval(() => {
      const audio = audioRef.current;
      if (audio) writePlaybackPosition(userId, storageId, { chunk: section, currentTime: audio.currentTime, updatedAt: Date.now() });
    }, 3000);
    return () => window.clearInterval(timer);
  }, [activeSection, section, storageId, userId]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio || !activeSection) return;
    if (playing) return void audio.pause();
    try { await audio.play(); } catch { setError("Audio LibriVox tidak dapat diputar dari browser ini."); }
  };
  const seek = (delta: number) => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + delta));
  };
  const moveSection = (target: number, autoplay = playing) => {
    if (!selected || target < 0 || target >= selected.sections.length) return;
    setSection(target); setElapsed(0); setDuration(0);
    window.setTimeout(() => { if (autoplay) void audioRef.current?.play(); }, 0);
  };
  const addBookmark = () => {
    if (!activeSection || !storageId) return;
    const next = [...bookmarks, { id: crypto.randomUUID(), chunk: section, currentTime: elapsed, label: `${activeSection.title} · ${time(elapsed)}`, createdAt: Date.now() }].sort((a, b) => a.chunk - b.chunk || a.currentTime - b.currentTime);
    setBookmarks(next); writeAudioBookmarks(userId, storageId, next);
  };
  const toggleSaved = () => {
    if (!selected) return;
    if (saved) removeSavedLibriVoxBook(userId, selected.id); else saveLibriVoxBook(userId, selected);
    setSaved(!saved);
  };
  const progress = duration ? elapsed / duration * 100 : 0;
  const readerNames = useMemo(() => activeSection?.readers.map((reader) => reader.name).join(", ") || "Pembaca LibriVox", [activeSection]);

  return <div className="view librivox-view">
    <audio ref={audioRef} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(event) => setElapsed(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onEnded={() => moveSection(section + 1, true)} />
    <section className="librivox-hero"><div><p className="eyebrow">AUDIOBOOK PUBLIC DOMAIN</p><h1>Jelajahi <em>LibriVox.</em></h1><p>Streaming audiobook gratis yang dibacakan relawan. Audio tetap berasal dari LibriVox dan Internet Archive.</p></div><Headphones size={48} /></section>
    <form className="librivox-search" onSubmit={(event) => { event.preventDefault(); if (page) setPage(0); else void loadCatalog(); }}><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari judul, penulis, atau genre..." /><select value={field} onChange={(event) => setField(event.target.value as LibriVoxSearchField)}><option value="title">Judul</option><option value="author">Penulis</option><option value="genre">Genre</option></select><button>Cari</button></form>
    {error && <p className="librivox-error">{error}</p>}

    {!selected ? <>
      {loading ? <div className="librivox-loading"><LoaderCircle className="spin" /> Memuat katalog…</div> : <div className="librivox-grid">{books.map((book) => <button key={book.id} className="librivox-card" onClick={() => void openBook(book)}><div className="librivox-cover">{book.thumbnailUrl ? <img src={book.thumbnailUrl} alt="" /> : <BookOpenText size={38} />}</div><div><small>{book.language} · {book.sectionCount || "?"} bagian</small><strong>{book.title}</strong><span>{book.author}</span><p>{book.totalTime || "Durasi belum tersedia"}</p></div></button>)}</div>}
      <div className="librivox-pagination"><button disabled={!page || loading} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft size={17} /> Sebelumnya</button><span>Halaman {page + 1}</span><button disabled={books.length < PAGE_SIZE || loading} onClick={() => setPage((value) => value + 1)}>Berikutnya <ChevronRight size={17} /></button></div>
    </> : <section className="librivox-detail">
      <button className="librivox-back" onClick={() => { audioRef.current?.pause(); setSelected(null); }}>← Kembali ke katalog</button>
      {detailLoading ? <div className="librivox-loading"><LoaderCircle className="spin" /> Memuat detail…</div> : <div className="librivox-detail-grid">
        <aside className="librivox-book-info"><div className="librivox-detail-cover">{selected.coverUrl ? <img src={selected.coverUrl} alt={`Sampul ${selected.title}`} /> : <BookOpenText size={54} />}</div><h2>{selected.title}</h2><p>{selected.author}</p><div className="librivox-meta"><span>{selected.language}</span><span>{selected.totalTime || `${selected.sectionCount} bagian`}</span></div><button className="librivox-save" onClick={toggleSaved}><Bookmark size={17} fill={saved ? "currentColor" : "none"} />{saved ? "Tersimpan di perpustakaan" : "Simpan ke perpustakaan"}</button><div className="librivox-links">{selected.librivoxUrl && <a href={selected.librivoxUrl} target="_blank" rel="noreferrer">Buka LibriVox <ExternalLink size={14} /></a>}{selected.textSourceUrl && <a href={selected.textSourceUrl} target="_blank" rel="noreferrer">Buka teks sumber <ExternalLink size={14} /></a>}</div><p className="librivox-description">{selected.description || "Deskripsi tidak tersedia."}</p></aside>
        <div className="librivox-player-area"><div className="librivox-now"><small>SEDANG DIPUTAR</small><h3>{activeSection?.title ?? "Pilih bagian"}</h3><p>{readerNames}</p></div><div className="librivox-timeline"><input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(elapsed, duration || 0)} onChange={(event) => { if (audioRef.current) audioRef.current.currentTime = Number(event.target.value); }} /><div><span>{time(elapsed)}</span><span>{time(duration)}</span></div></div><div className="librivox-controls"><button onClick={() => moveSection(section - 1)} disabled={!section}><SkipBack /></button><button onClick={() => seek(-15)}><RotateCcw /><small>15</small></button><button className="main" onClick={toggle}>{playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button><button onClick={() => seek(30)}><RotateCw /><small>30</small></button><button onClick={() => moveSection(section + 1)} disabled={section + 1 >= selected.sections.length}><SkipForward /></button></div><div className="librivox-tools"><button onClick={() => setSpeed(speed === 1 ? 1.25 : speed === 1.25 ? 1.5 : speed === 1.5 ? 2 : 1)}>{speed}× Kecepatan</button><button onClick={addBookmark}><Bookmark size={16} /> Simpan bookmark</button></div><div className="librivox-sections"><div className="head"><strong>Daftar bagian</strong><span>{selected.sections.length} bagian</span></div>{selected.sections.map((item, index) => <button key={item.id} className={index === section ? "active" : ""} onClick={() => moveSection(index, playing)}><span><b>{index + 1}</b><span><strong>{item.title}</strong><small>{item.readers.map((reader) => reader.name).join(", ") || "LibriVox"}</small></span></span><time>{item.duration || time(item.durationSeconds)}</time></button>)}</div>{bookmarks.length > 0 && <div className="librivox-bookmarks"><strong>Bookmark</strong>{bookmarks.map((item) => <button key={item.id} onClick={() => { moveSection(item.chunk, false); window.setTimeout(() => { if (audioRef.current) audioRef.current.currentTime = item.currentTime; }, 100); }}>{item.label}</button>)}</div>}<p className="librivox-note">LibriVox tidak menyediakan subtitle atau timestamp kalimat. Player menampilkan metadata chapter tanpa mengklaim sinkronisasi teks.</p></div>
      </div>}
    </section>}
  </div>;
}
