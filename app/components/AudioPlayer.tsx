"use client";

import { useEffect, useRef, useState } from "react";
import { ListMusic, Pause, Play, RotateCcw, RotateCw, Volume2 } from "lucide-react";
import { BookCover } from "./BookCover";
import type { Book } from "../lib/content";
import { getLocalBook } from "../lib/local-db";

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
};

export function AudioPlayer({ book }: { book: Book }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const urlsRef = useRef<string[]>([]);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [chunk, setChunk] = useState(0);
  const [chunks, setChunks] = useState(0);
  const [message, setMessage] = useState("Pilih buku lokal dengan audio siap");
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    urlsRef.current.forEach(URL.revokeObjectURL);
    urlsRef.current = [];
    let active = true;
    getLocalBook(book.id).then((asset) => {
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
      if (audioRef.current) audioRef.current.src = urlsRef.current[0];
    }).catch(() => setMessage("Audio lokal gagal dibuka"));
    return () => {
      active = false;
      audio?.pause();
      urlsRef.current.forEach(URL.revokeObjectURL);
      urlsRef.current = [];
    };
  }, [book]);

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
    setChunk(next);
    audioRef.current.src = urlsRef.current[next];
    audioRef.current.play().catch(() => setPlaying(false));
  };

  const cycleSpeed = () => {
    const next = speed === 1 ? 1.25 : speed === 1.25 ? 1.5 : 1;
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
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
        <div className="player-progress"><small>{formatTime(elapsed)}</small><button onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); if (audioRef.current && duration) audioRef.current.currentTime = ((event.clientX - rect.left) / rect.width) * duration; }} aria-label="Posisi audio"><span style={{ width: `${duration ? (elapsed / duration) * 100 : 0}%` }} /></button><small>{formatTime(duration)}</small></div>
      </div>
      <div className="player-tools">
        <button className="speed-button" onClick={cycleSpeed}>{speed}×</button>
        <button aria-label="Daftar bagian"><ListMusic size={19} /></button>
        <Volume2 size={18} />
        <div className="volume-track"><span /></div>
      </div>
    </section>
  );
}
