"use client";

import { useEffect, useRef, useState } from "react";
import { Bookmark, Moon, Pause, Play, RotateCcw, RotateCw, Trash2 } from "lucide-react";
import type { Book } from "../lib/content";
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

export function AccountAudioPlayer({ book, userId }: { book: Book; userId: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const urlsRef = useRef<string[]>([]);
  const saveTimerRef = useRef<number | null>(null);
  const sleepTimerRef = useRef<number | null>(null);
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

  useEffect(() => {
    let active = true;
    const audio = audioRef.current;
    audio?.pause();
    urlsRef.current.forEach(URL.revokeObjectURL);
    urlsRef.current = [];
    setBookmarks(readAudioBookmarks(userId, book.id));
    setSelectedBookmark("");

    getLocalBook(book.id)
      .then((asset) => {
        if (!active) return;
        setPlaying(false);
        setChunk(0);
        setElapsed(0);

        if (!asset?.audioChunks.length) {
          setChunks(0);
          setMessage(book.localOnly ? "Audio belum dibuat" : "Tidak ada audio lokal untuk akun ini");
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
          audioRef.current.playbackRate = speed;
        }

        setMessage(saved ? `Dilanjutkan dari bagian ${savedChunk + 1}` : `${urlsRef.current.length} bagian tersimpan untuk akun ini`);
      })
      .catch(() => setMessage("Audio lokal akun ini gagal dibuka"));

    return () => {
      active = false;
      audio?.pause();
      urlsRef.current.forEach(URL.revokeObjectURL);
      urlsRef.current = [];
    };
  }, [book, speed, userId]);

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
    if (!audio || !chunks) return;
    if (playing) audio.pause();
    else await audio.play();
  };

  const seek = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + seconds));
  };

  const nextChunk = () => {
    if (sleepMode === "end") {
      setSleepMode("off");
      setPlaying(false);
      return;
    }

    const next = chunk + 1;
    const audio = audioRef.current;
    if (!audio || next >= urlsRef.current.length) {
      setPlaying(false);
      return;
    }

    setChunk(next);
    audio.src = urlsRef.current[next];
    audio.playbackRate = speed;
    audio.play().catch(() => setPlaying(false));
  };

  const cycleSpeed = () => {
    const next = speed === 1 ? 1.25 : speed === 1.25 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const changeSleepMode = (next: SleepMode) => {
    setSleepMode(next);
    setSleepSecondsLeft(next === "off" || next === "end" ? null : Number(next) * 60);
  };

  const addBookmark = () => {
    const audio = audioRef.current;
    if (!audio || !chunks) return;
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
    const audio = audioRef.current;
    if (!bookmark || !audio || bookmark.chunk >= urlsRef.current.length) return;
    setChunk(bookmark.chunk);
    audio.src = urlsRef.current[bookmark.chunk];
    audio.currentTime = bookmark.currentTime;
    audio.playbackRate = speed;
    setElapsed(bookmark.currentTime);
    setMessage(`Berpindah ke ${bookmark.label}`);
  };

  const deleteBookmark = () => {
    if (!selectedBookmark) return;
    const updated = bookmarks.filter((item) => item.id !== selectedBookmark);
    setBookmarks(updated);
    setSelectedBookmark("");
    writeAudioBookmarks(userId, book.id, updated);
    setMessage("Bookmark dihapus");
  };

  return (
    <section className="audio-player" aria-label="Pemutar audio">
      <audio
        ref={audioRef}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => setElapsed(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onEnded={nextChunk}
      />
      <div className="player-book">
        <BookCover title={book.title} author={book.author} palette={book.palette} />
        <div><strong>{book.title}</strong><small>{chunks ? `Bagian ${chunk + 1} dari ${chunks}` : message}</small></div>
      </div>
      <div className="player-center">
        <div className="player-controls">
          <button onClick={() => seek(-15)} aria-label="Mundur 15 detik"><RotateCcw size={18} /><small>15</small></button>
          <button className="play-button" disabled={!chunks} onClick={toggle} aria-label={playing ? "Jeda" : "Putar"}>
            {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
          </button>
          <button onClick={() => seek(30)} aria-label="Maju 30 detik"><RotateCw size={18} /><small>30</small></button>
        </div>
        <div className="player-progress">
          <small>{formatTime(elapsed)}</small>
          <button
            aria-label="Posisi audio"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              if (audioRef.current && duration) audioRef.current.currentTime = ((event.clientX - rect.left) / rect.width) * duration;
            }}
          ><span style={{ width: `${duration ? (elapsed / duration) * 100 : 0}%` }} /></button>
          <small>{formatTime(duration)}</small>
        </div>
      </div>
      <div className="player-tools">
        <button className="speed-button" onClick={cycleSpeed}>{speed}×</button>
        <button className="speed-button" disabled={!chunks} onClick={addBookmark} aria-label="Simpan bookmark"><Bookmark size={15} /></button>
        <label className="sleep-button">
          <Bookmark size={15} />
          <select value={selectedBookmark} onChange={(event) => jumpToBookmark(event.target.value)} aria-label="Daftar bookmark">
            <option value="">{bookmarks.length ? `${bookmarks.length} bookmark` : "Bookmark"}</option>
            {bookmarks.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <button className="speed-button" disabled={!selectedBookmark} onClick={deleteBookmark} aria-label="Hapus bookmark"><Trash2 size={15} /></button>
        <label className={`sleep-button ${sleepMode !== "off" ? "active" : ""}`}>
          <Moon size={16} />
          <select value={sleepMode} onChange={(event) => changeSleepMode(event.target.value as SleepMode)} aria-label="Sleep timer">
            <option value="off">Off</option>
            <option value="15">15 mnt</option>
            <option value="30">30 mnt</option>
            <option value="60">60 mnt</option>
            <option value="end">Akhir part</option>
          </select>
          <span className="sleep-label">{sleepSecondsLeft === null ? (sleepMode === "end" ? "Akhir" : "Timer") : formatTime(sleepSecondsLeft)}</span>
        </label>
      </div>
    </section>
  );
}
