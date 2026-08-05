"use client";

import { useEffect, useRef, useState } from "react";
import { ListMusic, Moon, Pause, Play, RotateCcw, RotateCw, Volume2 } from "lucide-react";
import { BookCover } from "./BookCover";
import type { Book } from "../lib/content";
import { getLocalBook } from "../lib/local-db";

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
};

type SleepMode = "off" | "15" | "30" | "60" | "end";

export function AudioPlayer({ book }: { book: Book }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const urlsRef = useRef<string[]>([]);
  const sleepTimerRef = useRef<number | null>(null);
  const positionSaveRef = useRef<number | null>(null);

  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [chunk, setChunk] = useState(0);
  const [chunks, setChunks] = useState(0);
  const [message, setMessage] = useState("Pilih buku lokal dengan audio siap");
  const [speed, setSpeed] = useState(1);
  const [sleepMode, setSleepMode] = useState<SleepMode>("off");
  const [sleepSecondsLeft, setSleepSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    urlsRef.current.forEach(URL.revokeObjectURL);
    urlsRef.current = [];
    let active = true;

    getLocalBook(book.id)
      .then((asset) => {
        if (!active) return;

        setPlaying(false);
        setChunk(0);
        setElapsed(0);

        if (!asset?.audioChunks.length) {
          setChunks(0);
          setMessage(book.localOnly ? "Audio belum dibuat" : "Pilih buku yang kamu konversi");
          return;
        }

        urlsRef.current = asset.audioChunks.map((blob) => URL.createObjectURL(blob));
        setChunks(urlsRef.current.length);
        setMessage(`${urlsRef.current.length} bagian tersimpan lokal`);

        try {
          const saved = JSON.parse(localStorage.getItem(`apollonians-position-${book.id}`) ?? "{}");
          if (saved && typeof saved.chunk === "number" && saved.chunk < urlsRef.current.length) {
            setChunk(saved.chunk);
            if (audioRef.current) {
              audioRef.current.src = urlsRef.current[saved.chunk];
              audioRef.current.currentTime = saved.currentTime ?? 0;
            }
            setMessage(`Dilanjutkan dari bagian ${saved.chunk + 1}`);
            return;
          }
        } catch {
          // Abaikan posisi rusak dan mulai dari awal.
        }

        if (audioRef.current) audioRef.current.src = urlsRef.current[0];
      })
      .catch(() => setMessage("Audio lokal gagal dibuka"));

    return () => {
      active = false;
      audio?.pause();
      urlsRef.current.forEach(URL.revokeObjectURL);
      urlsRef.current = [];
    };
  }, [book]);

  useEffect(() => {
    if (positionSaveRef.current) window.clearInterval(positionSaveRef.current);

    positionSaveRef.current = window.setInterval(() => {
      if (!audioRef.current || !chunks) return;
      try {
        localStorage.setItem(
          `apollonians-position-${book.id}`,
          JSON.stringify({
            chunk,
            currentTime: audioRef.current.currentTime,
            updatedAt: Date.now(),
          }),
        );
      } catch {
        // Penyimpanan posisi bersifat best effort.
      }
    }, 3000);

    return () => {
      if (positionSaveRef.current) window.clearInterval(positionSaveRef.current);
    };
  }, [book.id, chunk, chunks]);

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

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      const audio = audioRef.current;
      if (!audio || !chunks) return;

      switch (event.code) {
        case "Space":
          event.preventDefault();
          if (playing) audio.pause();
          else audio.play().catch(() => undefined);
          break;
        case "ArrowLeft":
          event.preventDefault();
          audio.currentTime = Math.max(0, audio.currentTime - 15);
          break;
        case "ArrowRight":
          event.preventDefault();
          audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 30);
          break;
        case "Digit1":
        case "Numpad1":
          setSpeed(1);
          audio.playbackRate = 1;
          break;
        case "Digit2":
        case "Numpad2":
          setSpeed(1.25);
          audio.playbackRate = 1.25;
          break;
        case "Digit3":
        case "Numpad3":
          setSpeed(1.5);
          audio.playbackRate = 1.5;
          break;
        case "Digit4":
        case "Numpad4":
          setSpeed(2);
          audio.playbackRate = 2;
          break;
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [chunks, playing]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio || !chunks) return;
    if (playing) audio.pause();
    else await audio.play();
  };

  const seek = (amount: number) => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + amount));
  };

  const nextChunk = () => {
    const next = chunk + 1;
    if (next >= urlsRef.current.length || !audioRef.current) {
      setPlaying(false);
      return;
    }

    if (sleepMode === "end") {
      setPlaying(false);
      setSleepMode("off");
      setSleepSecondsLeft(null);
      return;
    }

    setChunk(next);
    audioRef.current.src = urlsRef.current[next];
    audioRef.current.play().catch(() => setPlaying(false));
  };

  const cycleSpeed = () => {
    const next = speed === 1 ? 1.25 : speed === 1.25 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const changeSleepMode = (nextMode: SleepMode) => {
    setSleepMode(nextMode);
    setSleepSecondsLeft(nextMode === "off" || nextMode === "end" ? null : Number(nextMode) * 60);
  };

  const sleepLabel = sleepMode === "off"
    ? "Timer"
    : sleepMode === "end"
      ? "Akhir"
      : sleepSecondsLeft !== null
        ? formatTime(sleepSecondsLeft)
        : sleepMode;

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
        <div>
          <strong>{book.title}</strong>
          <small>{chunks ? `Bagian ${chunk + 1} dari ${chunks}` : message}</small>
        </div>
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
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              if (audioRef.current && duration) {
                audioRef.current.currentTime = ((event.clientX - rect.left) / rect.width) * duration;
              }
            }}
            aria-label="Posisi audio"
          >
            <span style={{ width: `${duration ? (elapsed / duration) * 100 : 0}%` }} />
          </button>
          <small>{formatTime(duration)}</small>
        </div>
      </div>

      <div className="player-tools">
        <button className="speed-button" onClick={cycleSpeed} aria-label="Kecepatan">{speed}×</button>
        <label className={`sleep-button ${sleepMode !== "off" ? "active" : ""}`}>
          <Moon size={16} />
          <select
            value={sleepMode}
            onChange={(event) => changeSleepMode(event.target.value as SleepMode)}
            aria-label="Pilih durasi sleep"
          >
            <option value="off">Off</option>
            <option value="15">15 mnt</option>
            <option value="30">30 mnt</option>
            <option value="60">60 mnt</option>
            <option value="end">Akhir part</option>
          </select>
          <span className="sleep-label">{sleepLabel}</span>
        </label>
        <button aria-label="Daftar bagian"><ListMusic size={19} /></button>
        <Volume2 size={18} />
        <div className="volume-track"><span /></div>
      </div>
    </section>
  );
}
