"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, BookOpenText, ChevronDown, ListMusic, Moon, Pause, Play, RotateCcw, RotateCw, Search, SkipBack, SkipForward, Trash2, X } from "lucide-react";
import type { Book } from "../lib/content";
import { detectChapters, type DetectedChapter } from "../lib/chapters";
import { getLocalBook } from "../lib/local-db";
import { readAudioBookmarks, readPlaybackPosition, writeAudioBookmarks, writePlaybackPosition, type AudioBookmark } from "../lib/account-storage";
import { BookCover } from "./BookCover";

const time = (seconds: number) => Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}` : "0:00";
const readable = (text: string) => {
  const paragraphs = text.split(/\n\s*\n/).map((value) => value.replace(/\s+/g, " ").trim()).filter((value) => value.length > 20);
  return paragraphs.length ? paragraphs : text.split(/(?<=[.!?])\s+/).map((value) => value.trim()).filter((value) => value.length > 20);
};

type Panel = "chapters" | "bookmarks" | null;
type SleepMode = "off" | "15" | "30" | "60" | "end";

export function EnhancedAccountAudioPlayer({ book, userId }: { book: Book; userId: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const urlsRef = useRef<string[]>([]);
  const [playing, setPlaying] = useState(false);
  const [chunk, setChunk] = useState(0);
  const [chunks, setChunks] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [message, setMessage] = useState("Audio belum tersedia");
  const [chapters, setChapters] = useState<DetectedChapter[]>([]);
  const [bookmarks, setBookmarks] = useState<AudioBookmark[]>([]);
  const [textParts, setTextParts] = useState<string[]>([]);
  const [fullOpen, setFullOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [query, setQuery] = useState("");
  const [sleepMode, setSleepMode] = useState<SleepMode>("off");
  const [sleepLeft, setSleepLeft] = useState<number | null>(null);
  const hasAudio = chunks > 0;
  const overall = chunks ? (chunk + (duration ? elapsed / duration : 0)) / chunks : 0;

  const activeChapter = useMemo(() => [...chapters].reverse().find((item) => item.progress <= overall) ?? chapters[0] ?? null, [chapters, overall]);
  const textIndex = textParts.length ? Math.min(textParts.length - 1, Math.floor(overall * textParts.length)) : 0;
  const activeText = textParts[textIndex] ?? "Teks buku belum tersedia untuk bagian ini.";
  const previousText = textIndex > 0 ? textParts[textIndex - 1] : "";
  const nextText = textIndex + 1 < textParts.length ? textParts[textIndex + 1] : "";
  const filteredChapters = useMemo(() => query ? chapters.filter((item) => item.title.toLowerCase().includes(query.toLowerCase())) : chapters, [chapters, query]);
  const filteredBookmarks = useMemo(() => query ? bookmarks.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())) : bookmarks, [bookmarks, query]);

  useEffect(() => {
    let active = true;
    audioRef.current?.pause();
    urlsRef.current.forEach(URL.revokeObjectURL);
    urlsRef.current = [];
    getLocalBook(book.id).then((asset) => {
      if (!active) return;
      setBookmarks(readAudioBookmarks(userId, book.id));
      setChapters(asset?.text ? detectChapters(asset.text) : []);
      setTextParts(asset?.text ? readable(asset.text) : []);
      setFullOpen(false);
      setPanel(null);
      setPlaying(false);
      setElapsed(0);
      setDuration(0);
      if (!asset?.audioChunks.length) {
        setChunks(0);
        setMessage(book.localOnly ? "Audio belum dibuat" : "Audio belum tersedia di perangkat ini");
        return;
      }
      urlsRef.current = asset.audioChunks.map((blob) => URL.createObjectURL(blob));
      setChunks(urlsRef.current.length);
      const saved = readPlaybackPosition(userId, book.id);
      const savedChunk = saved && saved.chunk < urlsRef.current.length ? saved.chunk : 0;
      setChunk(savedChunk);
      const audio = audioRef.current;
      if (audio) {
        audio.src = urlsRef.current[savedChunk];
        audio.currentTime = saved?.currentTime ?? 0;
        audio.playbackRate = speed;
        audio.load();
      }
      setMessage(saved ? `Dilanjutkan dari bagian ${savedChunk + 1}` : `${urlsRef.current.length} bagian tersimpan`);
    }).catch(() => setMessage("Audio lokal gagal dibuka"));
    return () => { active = false; audioRef.current?.pause(); urlsRef.current.forEach(URL.revokeObjectURL); };
  }, [book.id, book.localOnly, userId]);

  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = speed; }, [speed]);
  useEffect(() => {
    if (!fullOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [fullOpen]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const audio = audioRef.current;
      if (!audio || !chunks) return;
      writePlaybackPosition(userId, book.id, { chunk, currentTime: audio.currentTime, updatedAt: Date.now() });
      window.dispatchEvent(new CustomEvent("apollonians-playback-progress", { detail: { bookId: book.id } }));
    }, 3000);
    return () => window.clearInterval(timer);
  }, [book.id, chunk, chunks, userId]);
  useEffect(() => {
    if (sleepMode === "off" || sleepMode === "end") return;
    const timer = window.setInterval(() => setSleepLeft((current) => {
      if (current === null || current <= 1) { audioRef.current?.pause(); setSleepMode("off"); return null; }
      return current - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [sleepMode]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio || !hasAudio) return;
    if (playing) return void audio.pause();
    try { await audio.play(); } catch { setMessage("Audio gagal diputar"); }
  };
  const seek = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + seconds));
  };
  const moveToChunk = (target: number, currentTime = 0, autoplay = false) => {
    const audio = audioRef.current;
    if (!audio || target < 0 || target >= urlsRef.current.length) return;
    setChunk(target);
    audio.src = urlsRef.current[target];
    audio.currentTime = currentTime;
    audio.playbackRate = speed;
    setElapsed(currentTime);
    setDuration(0);
    audio.load();
    if (autoplay) void audio.play().catch(() => setMessage(`Bagian ${target + 1} gagal diputar`));
  };
  const previousChunk = () => elapsed > 3 && audioRef.current ? void (audioRef.current.currentTime = 0) : moveToChunk(chunk - 1, 0, playing);
  const nextChunk = () => {
    if (sleepMode === "end") { setSleepMode("off"); return void audioRef.current?.pause(); }
    if (chunk + 1 >= urlsRef.current.length) return void setPlaying(false);
    moveToChunk(chunk + 1, 0, true);
  };
  const jumpChapter = (item: DetectedChapter) => { moveToChunk(Math.min(chunks - 1, Math.max(0, Math.floor(item.progress * chunks))), 0, playing); setPanel(null); };
  const moveChapter = (direction: -1 | 1) => {
    if (!chapters.length) return direction < 0 ? previousChunk() : nextChunk();
    const index = Math.max(0, chapters.findIndex((item) => item.id === activeChapter?.id));
    const target = chapters[index + direction];
    if (target) jumpChapter(target);
  };
  const addBookmark = () => {
    const audio = audioRef.current;
    if (!audio || !hasAudio) return;
    const item: AudioBookmark = { id: crypto.randomUUID(), chunk, currentTime: audio.currentTime, label: `${activeChapter?.title ?? `Bagian ${chunk + 1}`} · ${time(audio.currentTime)}`, createdAt: Date.now() };
    const updated = [...bookmarks, item].sort((a, b) => a.chunk - b.chunk || a.currentTime - b.currentTime);
    setBookmarks(updated);
    writeAudioBookmarks(userId, book.id, updated);
  };
  const deleteBookmark = (id: string) => { const updated = bookmarks.filter((item) => item.id !== id); setBookmarks(updated); writeAudioBookmarks(userId, book.id, updated); };
  const changeSleep = (value: SleepMode) => { setSleepMode(value); setSleepLeft(value === "off" || value === "end" ? null : Number(value) * 60); };
  const openPanel = (value: Panel) => { setPanel(panel === value ? null : value); setQuery(""); };
  const progress = duration ? Math.min(100, elapsed / duration * 100) : 0;

  return <>
    <section className={`audio-player ${hasAudio ? "" : "is-unavailable"}`} aria-label="Pemutar audio">
      <audio ref={audioRef} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(event) => setElapsed(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onEnded={nextChunk} />
      <button className="player-book player-book-open" disabled={!hasAudio} onClick={() => hasAudio ? setFullOpen(true) : setMessage("Audio belum tersedia")}>
        <BookCover title={book.title} author={book.author} palette={book.palette} />
        <div><strong>{book.title}</strong><small>{hasAudio ? `${activeChapter?.title ?? `Bagian ${chunk + 1}`} · ${chunk + 1}/${chunks}` : message}</small></div>
        <ChevronDown className="player-expand-icon" size={18} />
      </button>
      <div className="player-center"><div className="player-controls"><button disabled={!hasAudio} onClick={() => seek(-15)}><RotateCcw size={18} /><small>15</small></button><button className="play-button" disabled={!hasAudio} onClick={toggle}>{playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}</button><button disabled={!hasAudio} onClick={() => seek(30)}><RotateCw size={18} /><small>30</small></button></div><div className="player-progress"><small>{time(elapsed)}</small><button disabled={!hasAudio} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); if (audioRef.current && duration) audioRef.current.currentTime = ((event.clientX - rect.left) / rect.width) * duration; }}><span style={{ width: `${progress}%` }} /></button><small>{time(duration)}</small></div></div>
      <div className="player-tools"><button className="speed-button" disabled={!hasAudio} onClick={() => setSpeed(speed === 1 ? 1.25 : speed === 1.25 ? 1.5 : speed === 1.5 ? 2 : 1)}>{speed}×</button><button className="sleep-button" disabled={!hasAudio} onClick={() => { setFullOpen(true); openPanel("chapters"); }}><BookOpenText size={15} />{chapters.length} bab</button><button className="speed-button" disabled={!hasAudio} onClick={addBookmark}><Bookmark size={15} /></button><button className="sleep-button" disabled={!hasAudio} onClick={() => { setFullOpen(true); openPanel("bookmarks"); }}><ListMusic size={15} />{bookmarks.length} bookmark</button><label className="sleep-button"><Moon size={16} /><select disabled={!hasAudio} value={sleepMode} onChange={(event) => changeSleep(event.target.value as SleepMode)}><option value="off">Off</option><option value="15">15 mnt</option><option value="30">30 mnt</option><option value="60">60 mnt</option><option value="end">Akhir part</option></select><span>{sleepLeft === null ? "Timer" : time(sleepLeft)}</span></label></div>
    </section>

    {fullOpen && hasAudio && <section className="full-player-v2" role="dialog" aria-modal="true" aria-label="Player penuh">
      <header><button onClick={() => { setFullOpen(false); setPanel(null); }}><X size={22} /></button><div><strong>Sedang diputar</strong><small>{activeChapter?.title ?? `Bagian ${chunk + 1}`}</small></div><button onClick={addBookmark}><Bookmark size={21} /></button></header>
      <div className="full-player-v2-main"><div className="full-player-v2-book"><div><BookCover title={book.title} author={book.author} palette={book.palette} /></div><p>{activeChapter?.title ?? `Bagian ${chunk + 1} dari ${chunks}`}</p><h2>{book.title}</h2><span>{book.author}</span></div><article className="reader-transcript-v2"><div><span>Posisi bacaan</span><strong>{Math.max(1, Math.round(overall * 100))}%</strong></div>{previousText && <p className="context">{previousText}</p>}<p className="active">{activeText}</p>{nextText && <p className="context">{nextText}</p>}<small>Perkiraan sinkronisasi berdasarkan bagian audio dan posisi waktu.</small></article></div>
      <div className="full-player-v2-timeline"><input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(elapsed, duration || 0)} onChange={(event) => { if (audioRef.current) audioRef.current.currentTime = Number(event.target.value); }} /><div><small>{time(elapsed)}</small><small>{time(duration)}</small></div></div>
      <div className="full-player-v2-controls"><button onClick={() => moveChapter(-1)}><SkipBack size={24} /></button><button onClick={() => seek(-15)}><RotateCcw size={25} /><small>15</small></button><button className="main" onClick={toggle}>{playing ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" />}</button><button onClick={() => seek(30)}><RotateCw size={25} /><small>30</small></button><button onClick={() => moveChapter(1)}><SkipForward size={24} /></button></div>
      <div className="full-player-v2-tools"><button onClick={() => setSpeed(speed === 1 ? 1.25 : speed === 1.25 ? 1.5 : speed === 1.5 ? 2 : 1)}>{speed}×<small>Kecepatan</small></button><button onClick={() => openPanel("chapters")}><BookOpenText size={19} /><small>Bab</small></button><button onClick={() => openPanel("bookmarks")}><ListMusic size={19} /><small>Bookmark</small></button><label><Moon size={19} /><select value={sleepMode} onChange={(event) => changeSleep(event.target.value as SleepMode)}><option value="off">Off</option><option value="15">15 menit</option><option value="30">30 menit</option><option value="60">60 menit</option><option value="end">Akhir bagian</option></select><small>Timer</small></label></div>
      {panel && <aside className="player-data-panel"><div className="head"><div><strong>{panel === "chapters" ? "Daftar bab" : "Daftar bookmark"}</strong><small>{panel === "chapters" ? `${chapters.length} bagian` : `${bookmarks.length} tersimpan`}</small></div><button onClick={() => setPanel(null)}><X size={18} /></button></div><label className="search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Cari ${panel === "chapters" ? "bab" : "bookmark"}`} /></label><div className="columns"><span>Nama</span><span>Posisi</span><span>Aksi</span></div><div className="rows">{panel === "chapters" ? filteredChapters.map((item, index) => <button key={item.id} className={item.id === activeChapter?.id ? "active" : ""} onClick={() => jumpChapter(item)}><span><b>{index + 1}</b><em>{item.title}</em></span><small>{Math.round(item.progress * 100)}%</small><i>Putar</i></button>) : filteredBookmarks.map((item) => <div key={item.id}><button onClick={() => { moveToChunk(item.chunk, item.currentTime, playing); setPanel(null); }}><span><b>{item.chunk + 1}</b><em>{item.label}</em></span><small>{time(item.currentTime)}</small><i>Putar</i></button><button onClick={() => deleteBookmark(item.id)}><Trash2 size={16} /></button></div>)}</div></aside>}
    </section>}
  </>;
}
