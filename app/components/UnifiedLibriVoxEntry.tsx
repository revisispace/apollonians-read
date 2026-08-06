"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, LoaderCircle, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { getLibriVoxBook, listSavedLibriVoxBooks, type LibriVoxBook } from "../lib/librivox";
import { readPlaybackPosition, writePlaybackPosition } from "../lib/account-storage";
import { LibriVoxView } from "./LibriVoxView";

const formatTime = (seconds: number) => Number.isFinite(seconds)
  ? `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`
  : "0:00";

export function UnifiedLibriVoxEntry({ userId }: { userId: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [pendingId, setPendingId] = useState(() => {
    if (typeof window === "undefined") return "";
    const value = sessionStorage.getItem("apollonians:librivox-open") ?? "";
    sessionStorage.removeItem("apollonians:librivox-open");
    return value;
  });
  const [book, setBook] = useState<LibriVoxBook | null>(null);
  const [section, setSection] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(Boolean(pendingId));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!pendingId) return;
    let active = true;
    const saved = listSavedLibriVoxBooks(userId).find((item) => item.id === pendingId);
    const load = async () => {
      try {
        const detail = saved?.sections.length ? saved : await getLibriVoxBook(pendingId);
        if (!active) return;
        const position = readPlaybackPosition(userId, `librivox-${detail.id}`);
        setBook(detail);
        setSection(position && position.chunk < detail.sections.length ? position.chunk : 0);
      } catch (problem) {
        if (active) setError(problem instanceof Error ? problem.message : "Audiobook gagal dibuka.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [pendingId, userId]);

  const activeSection = book?.sections[section];
  const storageId = book ? `librivox-${book.id}` : "";

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !activeSection) return;
    const position = storageId ? readPlaybackPosition(userId, storageId) : null;
    audio.pause();
    audio.src = activeSection.audioUrl;
    audio.load();
    const restore = () => {
      if (position?.chunk === section && position.currentTime < audio.duration) audio.currentTime = position.currentTime;
    };
    audio.addEventListener("loadedmetadata", restore, { once: true });
    return () => audio.removeEventListener("loadedmetadata", restore);
  }, [activeSection, section, storageId, userId]);

  useEffect(() => {
    if (!storageId || !activeSection) return;
    const timer = window.setInterval(() => {
      const audio = audioRef.current;
      if (audio) writePlaybackPosition(userId, storageId, { chunk: section, currentTime: audio.currentTime, updatedAt: Date.now() });
    }, 3000);
    return () => window.clearInterval(timer);
  }, [activeSection, section, storageId, userId]);

  const totalProgress = useMemo(() => {
    if (!book?.sections.length) return 0;
    return Math.min(99, Math.round(((section + (elapsed > 0 ? 0.5 : 0)) / book.sections.length) * 100));
  }, [book, elapsed, section]);

  if (!pendingId) return <LibriVoxView userId={userId} />;

  if (loading) return <div className="view librivox-view"><div className="librivox-loading"><LoaderCircle className="spin" /> Menyiapkan audiobook tersimpan…</div></div>;

  if (error || !book || !activeSection) return <div className="view librivox-view"><button className="librivox-back" onClick={() => setPendingId("")}><ArrowLeft size={16} /> Kembali ke katalog</button><p className="librivox-error">{error || "Chapter audio tidak tersedia."}</p></div>;

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) await audio.play(); else audio.pause();
  };
  const move = (target: number) => {
    if (target < 0 || target >= book.sections.length) return;
    setSection(target);
    setElapsed(0);
    setDuration(0);
  };

  return <div className="view librivox-view unified-librivox-player">
    <audio ref={audioRef} preload="auto" onPlaying={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(event) => setElapsed(event.currentTarget.currentTime)} onDurationChange={(event) => setDuration(event.currentTarget.duration)} onEnded={() => move(section + 1)} />
    <button className="librivox-back" onClick={() => { audioRef.current?.pause(); setPendingId(""); }}><ArrowLeft size={16} /> Kembali ke katalog</button>
    <section className="librivox-detail">
      <div className="librivox-detail-grid">
        <aside className="librivox-book-info">
          <div className="librivox-detail-cover">{book.coverUrl ? <img src={book.coverUrl} alt={`Sampul ${book.title}`} /> : null}</div>
          <p className="eyebrow">LIBRIVOX · STREAMING</p><h2>{book.title}</h2><p>{book.author}</p>
          <div className="librivox-meta"><span>{section + 1}/{book.sections.length} bagian</span><span>{totalProgress}%</span></div>
        </aside>
        <div className="librivox-player-area">
          <div className="librivox-now"><small>SEDANG DIPUTAR</small><h3>{activeSection.title}</h3><p>{activeSection.readers.map((reader) => reader.name).join(", ") || "Pembaca LibriVox"}</p></div>
          <div className="librivox-timeline"><input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(elapsed, duration || 0)} onChange={(event) => { if (audioRef.current) audioRef.current.currentTime = Number(event.target.value); }} /><div><span>{formatTime(elapsed)}</span><span>{formatTime(duration)}</span></div></div>
          <div className="librivox-controls"><button disabled={!section} onClick={() => move(section - 1)}><SkipBack /></button><button className="main" onClick={toggle}>{playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button><button disabled={section + 1 >= book.sections.length} onClick={() => move(section + 1)}><SkipForward /></button></div>
          <div className="librivox-sections"><div className="head"><strong>Daftar bagian</strong><span>{book.sections.length} bagian</span></div>{book.sections.map((item, index) => <button key={item.id} className={index === section ? "active" : ""} onClick={() => move(index)}><span><b>{index + 1}</b><span><strong>{item.title}</strong><small>{item.readers.map((reader) => reader.name).join(", ") || "LibriVox"}</small></span></span><time>{item.duration || formatTime(item.durationSeconds)}</time></button>)}</div>
        </div>
      </div>
    </section>
  </div>;
}
