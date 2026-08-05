"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  BookOpenText,
  ChevronDown,
  ListMusic,
  Moon,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  Trash2,
  X,
} from "lucide-react";
import type { Book } from "../lib/content";
import { detectChapters, type DetectedChapter } from "../lib/chapters";
import { getLocalBook } from "../lib/local-db";
import {
  readAudioBookmarks,
  readPlaybackPosition,
  writeAudioBookmarks,
  writePlaybackPosition,
  type AudioBookmark,
} from "../lib/account-storage";
import { BookCover } from "./BookCover";

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
};

type SleepMode = "off" | "15" | "30" | "60" | "end";
type MobilePanel = "chapters" | "bookmarks" | null;

export function AccountAudioPlayer({ book, userId }: { book: Book; userId: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const urlsRef = useRef<string[]>([]);
  const saveTimerRef = useRef<number | null>(null);
  const sleepTimerRef = useRef<number | null>(null);
  const speedRef = useRef(1);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [chunk, setChunk] = useState(0);
  const [chunks, setChunks] = useState(0);
  const [message, setMessage] = useState("Audio belum tersedia");
  const [speed, setSpeed] = useState(1);
  const [sleepMode, setSleepMode] = useState<SleepMode>("off");
  const [sleepSecondsLeft, setSleepSecondsLeft] = useState<number | null>(null);
  const [bookmarks, setBookmarks] = useState<AudioBookmark[]>([]);
  const [selectedBookmark, setSelectedBookmark] = useState("");
  const [chapters, setChapters] = useState<DetectedChapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const hasAudio = chunks > 0;

  const activeChapter = useMemo(() => {
    if (!chapters.length || !chunks) return null;
    const progress = (chunk + (duration ? elapsed / duration : 0)) / chunks;
    return [...chapters].reverse().find((item) => item.progress <= progress) ?? chapters[0];
  }, [chapters, chunk, chunks, duration, elapsed]);

  useEffect(() => {
    let active = true;
    const audio = audioRef.current;
    audio?.pause();
    if (audio) {
      audio.removeAttribute("src");
      audio.load();
    }
    urlsRef.current.forEach(URL.revokeObjectURL);
    urlsRef.current = [];

    getLocalBook(book.id)
      .then((asset) => {
        if (!active) return;
        setBookmarks(readAudioBookmarks(userId, book.id));
        setSelectedBookmark("");
        setChapters(asset?.text ? detectChapters(asset.text) : []);
        setSelectedChapter("");
        setPlaying(false);
        setChunk(0);
        setElapsed(0);
        setDuration(0);
        setMobileOpen(false);
        setMobilePanel(null);

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

        if (audioRef.current) {
          audioRef.current.src = urlsRef.current[savedChunk];
          audioRef.current.currentTime = saved?.currentTime ?? 0;
          audioRef.current.playbackRate = speedRef.current;
          audioRef.current.load();
        }

        setMessage(saved ? `Dilanjutkan dari bagian ${savedChunk + 1}` : `${urlsRef.current.length} bagian tersimpan untuk akun ini`);
      })
      .catch(() => {
        if (active) {
          setChunks(0);
          setMessage("Audio lokal akun ini gagal dibuka");
        }
      });

    return () => {
      active = false;
      audio?.pause();
      urlsRef.current.forEach(URL.revokeObjectURL);
      urlsRef.current = [];
    };
  }, [book.id, book.localOnly, userId]);

  useEffect(() => {
    speedRef.current = speed;
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (saveTimerRef.current) window.clearInterval(saveTimerRef.current);
    saveTimerRef.current = window.setInterval(() => {
      const audio = audioRef.current;
      if (!audio || !chunks) return;
      writePlaybackPosition(userId, book.id, {
        chunk,
        currentTime: audio.currentTime,
        updatedAt: Date.now(),
      });
    }, 3000);

    return () => {
      if (saveTimerRef.current) window.clearInterval(saveTimerRef.current);
    };
  }, [book.id, chunk, chunks, userId]);

  useEffect(() => {
    if (sleepTimerRef.current) window.clearInterval(sleepTimerRef.current);
    if (sleepMode === "off" || sleepMode === "end") return;

    sleepTimerRef.current = window.setInterval(() => {
      setSleepSecondsLeft((current) => {
        if (current === null || current <= 1) {
          audioRef.current?.pause();
          setSleepMode("off");
          return null;
        }
        return current - 1;
      });
    }, 1000);

    return () => {
      if (sleepTimerRef.current) window.clearInterval(sleepTimerRef.current);
    };
  }, [sleepMode]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio || !hasAudio) return;
    if (playing) {
      audio.pause();
      return;
    }
    try {
      await audio.play();
    } catch {
      setPlaying(false);
      setMessage("Audio gagal diputar. Coba buka ulang buku ini.");
    }
  };

  const seek = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !hasAudio) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + seconds));
  };

  const moveToChunk = (target: number, currentTime = 0, autoplay = false) => {
    const audio = audioRef.current;
    if (!audio || target < 0 || target >= urlsRef.current.length) return;
    setChunk(target);
    audio.src = urlsRef.current[target];
    audio.currentTime = currentTime;
    audio.playbackRate = speedRef.current;
    setElapsed(currentTime);
    setDuration(0);
    audio.load();
    if (autoplay) {
      audio.play().catch(() => {
        setPlaying(false);
        setMessage(`Bagian ${target + 1} gagal diputar`);
      });
    }
  };

  const previousChunk = () => {
    if (!hasAudio) return;
    if (elapsed > 3) {
      if (audioRef.current) audioRef.current.currentTime = 0;
      return;
    }
    moveToChunk(chunk - 1, 0, playing);
  };

  const nextChunk = () => {
    if (!hasAudio) return;
    if (sleepMode === "end") {
      setSleepMode("off");
      setPlaying(false);
      return;
    }

    const next = chunk + 1;
    if (next >= urlsRef.current.length) {
      setPlaying(false);
      return;
    }
    moveToChunk(next, 0, true);
  };

  const cycleSpeed = () => {
    if (!hasAudio) return;
    const next = speed === 1 ? 1.25 : speed === 1.25 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
  };

  const changeSleepMode = (next: SleepMode) => {
    if (!hasAudio) return;
    setSleepMode(next);
    setSleepSecondsLeft(next === "off" || next === "end" ? null : Number(next) * 60);
  };

  const addBookmark = () => {
    const audio = audioRef.current;
    if (!audio || !hasAudio) return;
    const next: AudioBookmark = {
      id: crypto.randomUUID(),
      chunk,
      currentTime: audio.currentTime,
      label: `Bagian ${chunk + 1} · ${formatTime(audio.currentTime)}`,
      createdAt: Date.now(),
    };
    const updated = [...bookmarks, next].sort((left, right) => left.chunk - right.chunk || left.currentTime - right.currentTime);
    setBookmarks(updated);
    setSelectedBookmark(next.id);
    writeAudioBookmarks(userId, book.id, updated);
    setMessage(`Bookmark disimpan pada ${next.label}`);
  };

  const jumpToBookmark = (bookmarkId: string) => {
    setSelectedBookmark(bookmarkId);
    const bookmark = bookmarks.find((item) => item.id === bookmarkId);
    if (!bookmark || !hasAudio) return;
    moveToChunk(bookmark.chunk, bookmark.currentTime, playing);
    setMessage(`Berpindah ke ${bookmark.label}`);
    setMobilePanel(null);
  };

  const deleteBookmark = (bookmarkId = selectedBookmark) => {
    if (!bookmarkId) return;
    const updated = bookmarks.filter((item) => item.id !== bookmarkId);
    setBookmarks(updated);
    setSelectedBookmark("");
    writeAudioBookmarks(userId, book.id, updated);
    setMessage("Bookmark dihapus");
  };

  const jumpToChapter = (chapterId: string) => {
    setSelectedChapter(chapterId);
    const chapter = chapters.find((item) => item.id === chapterId);
    if (!chapter || !hasAudio) return;
    const target = Math.min(chunks - 1, Math.max(0, Math.floor(chapter.progress * chunks)));
    moveToChunk(target, 0, playing);
    setMessage(`Berpindah ke ${chapter.title}`);
    setMobilePanel(null);
  };

  const moveChapter = (direction: -1 | 1) => {
    if (!hasAudio) return;
    if (!chapters.length) {
      if (direction < 0) previousChunk();
      else nextChunk();
      return;
    }
    const currentIndex = Math.max(0, chapters.findIndex((item) => item.id === activeChapter?.id));
    const target = chapters[currentIndex + direction];
    if (target) jumpToChapter(target.id);
  };

  const openMobilePlayer = () => {
    if (!hasAudio) {
      setMessage(book.localOnly ? "Buat audio terlebih dahulu" : "Audio belum tersedia di perangkat ini");
      return;
    }
    setMobileOpen(true);
  };

  useEffect(() => {
    if (!hasAudio || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: book.title,
      artist: book.author,
      album: activeChapter?.title ?? `Bagian ${chunk + 1} dari ${chunks}`,
    });
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";
    navigator.mediaSession.setActionHandler("play", () => void audioRef.current?.play());
    navigator.mediaSession.setActionHandler("pause", () => audioRef.current?.pause());
    navigator.mediaSession.setActionHandler("seekbackward", (details) => seek(-(details.seekOffset ?? 15)));
    navigator.mediaSession.setActionHandler("seekforward", (details) => seek(details.seekOffset ?? 30));
    navigator.mediaSession.setActionHandler("previoustrack", previousChunk);
    navigator.mediaSession.setActionHandler("nexttrack", nextChunk);

    return () => {
      for (const action of ["play", "pause", "seekbackward", "seekforward", "previoustrack", "nexttrack"] as MediaSessionAction[]) {
        navigator.mediaSession.setActionHandler(action, null);
      }
    };
  }, [activeChapter?.title, book.author, book.title, chunk, chunks, hasAudio, playing]);

  useEffect(() => {
    if (!hasAudio || !("mediaSession" in navigator) || !duration || !Number.isFinite(duration)) return;
    try {
      navigator.mediaSession.setPositionState({ duration, playbackRate: speed, position: Math.min(elapsed, duration) });
    } catch {
      // Some browsers reject position updates while metadata is still loading.
    }
  }, [duration, elapsed, hasAudio, speed]);

  const progress = duration ? Math.min(100, (elapsed / duration) * 100) : 0;

  return (
    <>
      <section className={`audio-player ${hasAudio ? "" : "is-unavailable"}`} aria-label="Pemutar audio">
        <audio
          ref={audioRef}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(event) => setElapsed(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          onError={() => {
            if (hasAudio) {
              setPlaying(false);
              setMessage(`Bagian ${chunk + 1} gagal dimuat`);
            }
          }}
          onEnded={nextChunk}
        />
        <button className="player-book player-book-open" disabled={!hasAudio} onClick={openMobilePlayer} aria-label={hasAudio ? "Buka player penuh" : message}>
          <BookCover title={book.title} author={book.author} palette={book.palette} />
          <div><strong>{book.title}</strong><small>{hasAudio ? `Bagian ${chunk + 1} dari ${chunks}` : message}</small></div>
          <ChevronDown className="player-expand-icon" size={18} />
        </button>
        <div className="player-center">
          <div className="player-controls">
            <button disabled={!hasAudio} onClick={() => seek(-15)} aria-label="Mundur 15 detik"><RotateCcw size={18} /><small>15</small></button>
            <button className="play-button" disabled={!hasAudio} onClick={toggle} aria-label={playing ? "Jeda" : "Putar"}>
              {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>
            <button disabled={!hasAudio} onClick={() => seek(30)} aria-label="Maju 30 detik"><RotateCw size={18} /><small>30</small></button>
          </div>
          <div className="player-progress">
            <small>{formatTime(elapsed)}</small>
            <button disabled={!hasAudio} aria-label="Posisi audio" onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              if (audioRef.current && duration) audioRef.current.currentTime = ((event.clientX - rect.left) / rect.width) * duration;
            }}><span style={{ width: `${progress}%` }} /></button>
            <small>{formatTime(duration)}</small>
          </div>
        </div>
        <div className="player-tools" aria-hidden={!hasAudio}>
          <button className="speed-button" disabled={!hasAudio} onClick={cycleSpeed}>{speed}×</button>
          <label className="sleep-button"><BookOpenText size={15} /><select disabled={!hasAudio} value={selectedChapter} onChange={(event) => jumpToChapter(event.target.value)} aria-label="Daftar bab"><option value="">{chapters.length ? `${chapters.length} bab` : "Bab tidak terdeteksi"}</option>{chapters.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
          <button className="speed-button" disabled={!hasAudio} onClick={addBookmark} aria-label="Simpan bookmark"><Bookmark size={15} /></button>
          <label className="sleep-button"><Bookmark size={15} /><select disabled={!hasAudio} value={selectedBookmark} onChange={(event) => jumpToBookmark(event.target.value)} aria-label="Daftar bookmark"><option value="">{bookmarks.length ? `${bookmarks.length} bookmark` : "Bookmark"}</option>{bookmarks.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <button className="speed-button" disabled={!hasAudio || !selectedBookmark} onClick={() => deleteBookmark()} aria-label="Hapus bookmark"><Trash2 size={15} /></button>
          <label className={`sleep-button ${sleepMode !== "off" ? "active" : ""}`}><Moon size={16} /><select disabled={!hasAudio} value={sleepMode} onChange={(event) => changeSleepMode(event.target.value as SleepMode)} aria-label="Sleep timer"><option value="off">Off</option><option value="15">15 mnt</option><option value="30">30 mnt</option><option value="60">60 mnt</option><option value="end">Akhir part</option></select><span className="sleep-label">{sleepSecondsLeft === null ? (sleepMode === "end" ? "Akhir" : "Timer") : formatTime(sleepSecondsLeft)}</span></label>
        </div>
      </section>

      {mobileOpen && hasAudio && (
        <section className="mobile-full-player" role="dialog" aria-modal="true" aria-label="Player penuh">
          <header className="mobile-player-header">
            <button onClick={() => { setMobileOpen(false); setMobilePanel(null); }} aria-label="Tutup player penuh"><X size={22} /></button>
            <div><strong>Sedang diputar</strong><small>{activeChapter?.title ?? `Bagian ${chunk + 1}`}</small></div>
            <button onClick={addBookmark} aria-label="Simpan bookmark"><Bookmark size={21} /></button>
          </header>

          <div className="mobile-player-art"><BookCover title={book.title} author={book.author} palette={book.palette} /></div>
          <div className="mobile-player-copy"><p>{activeChapter?.title ?? `Bagian ${chunk + 1} dari ${chunks}`}</p><h2>{book.title}</h2><span>{book.author}</span></div>

          <div className="mobile-player-timeline">
            <input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(elapsed, duration || 0)} onChange={(event) => { if (audioRef.current) audioRef.current.currentTime = Number(event.target.value); }} aria-label="Posisi audio" />
            <div><small>{formatTime(elapsed)}</small><small>{formatTime(duration)}</small></div>
          </div>

          <div className="mobile-player-primary-controls">
            <button onClick={() => moveChapter(-1)} aria-label="Bab sebelumnya"><SkipBack size={25} fill="currentColor" /></button>
            <button onClick={() => seek(-15)} aria-label="Mundur 15 detik"><RotateCcw size={27} /><small>15</small></button>
            <button className="mobile-main-play" onClick={toggle} aria-label={playing ? "Jeda" : "Putar"}>{playing ? <Pause size={34} fill="currentColor" /> : <Play size={34} fill="currentColor" />}</button>
            <button onClick={() => seek(30)} aria-label="Maju 30 detik"><RotateCw size={27} /><small>30</small></button>
            <button onClick={() => moveChapter(1)} aria-label="Bab berikutnya"><SkipForward size={25} fill="currentColor" /></button>
          </div>

          <div className="mobile-player-secondary-controls">
            <button onClick={cycleSpeed}><strong>{speed}×</strong><small>Kecepatan</small></button>
            <label><Moon size={20} /><select value={sleepMode} onChange={(event) => changeSleepMode(event.target.value as SleepMode)} aria-label="Sleep timer"><option value="off">Off</option><option value="15">15 menit</option><option value="30">30 menit</option><option value="60">60 menit</option><option value="end">Akhir bagian</option></select><small>Timer</small></label>
            <button onClick={() => setMobilePanel(mobilePanel === "chapters" ? null : "chapters")}><BookOpenText size={20} /><small>Bab</small></button>
            <button onClick={() => setMobilePanel(mobilePanel === "bookmarks" ? null : "bookmarks")}><ListMusic size={20} /><small>Bookmark</small></button>
          </div>

          {mobilePanel && (
            <div className="mobile-player-panel">
              <div className="mobile-player-panel-head"><strong>{mobilePanel === "chapters" ? "Daftar bab" : "Daftar bookmark"}</strong><button onClick={() => setMobilePanel(null)} aria-label="Tutup panel"><X size={18} /></button></div>
              {mobilePanel === "chapters" ? (
                chapters.length ? chapters.map((item) => <button key={item.id} className={item.id === activeChapter?.id ? "active" : ""} onClick={() => jumpToChapter(item.id)}><span>{item.title}</span><small>{Math.round(item.progress * 100)}%</small></button>) : <p>Bab belum terdeteksi pada buku ini.</p>
              ) : (
                bookmarks.length ? bookmarks.map((item) => <div key={item.id}><button onClick={() => jumpToBookmark(item.id)}><span>{item.label}</span><small>Bagian {item.chunk + 1}</small></button><button onClick={() => deleteBookmark(item.id)} aria-label={`Hapus ${item.label}`}><Trash2 size={17} /></button></div>) : <p>Belum ada bookmark. Tekan ikon bookmark untuk menyimpan posisi.</p>
              )}
            </div>
          )}
        </section>
      )}
    </>
  );
}
