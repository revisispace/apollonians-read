"use client";

import { useEffect, useState } from "react";
import { ListMusic, Pause, Play, RotateCcw, RotateCw, Volume2 } from "lucide-react";
import { BookCover } from "./BookCover";
import type { Book } from "../lib/content";

export function AudioPlayer({ book }: { book: Book }) {
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(38);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setElapsed((value) => (value >= 100 ? 0 : value + 0.18)), 1000);
    return () => window.clearInterval(timer);
  }, [playing]);

  return (
    <section className="audio-player" aria-label="Pemutar audio">
      <div className="player-book">
        <BookCover title={book.title} author={book.author} palette={book.palette} />
        <div><strong>{book.title}</strong><small>Bab 7 · Jerzy Dudek</small></div>
      </div>
      <div className="player-center">
        <div className="player-controls">
          <button aria-label="Mundur 15 detik"><RotateCcw size={18} /><small>15</small></button>
          <button className="play-button" onClick={() => setPlaying(!playing)} aria-label={playing ? "Jeda" : "Putar"}>
            {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
          </button>
          <button aria-label="Maju 30 detik"><RotateCw size={18} /><small>30</small></button>
        </div>
        <div className="player-progress"><small>18:42</small><button aria-label="Posisi audio"><span style={{ width: `${elapsed}%` }} /></button><small>42:08</small></div>
      </div>
      <div className="player-tools">
        <button className="speed-button">1.0×</button>
        <button aria-label="Daftar bab"><ListMusic size={19} /></button>
        <Volume2 size={18} />
        <div className="volume-track"><span /></div>
      </div>
    </section>
  );
}
