"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpenText, Plus, RefreshCw, RotateCcw, Save, Trash2 } from "lucide-react";
import { clearCustomChapters, readCustomChapters, writeCustomChapters } from "../lib/account-storage";
import { chaptersFromAudioChunks, detectChapters, normalizeChapters, type DetectedChapter } from "../lib/chapters";
import { listLocalBooks, type AccountLocalBookAsset } from "../lib/local-db";

type ChapterMode = "audio" | "manual";

export function ChapterManagement({ userId }: { userId: string }) {
  const [assets, setAssets] = useState<AccountLocalBookAsset[]>([]);
  const [bookId, setBookId] = useState("");
  const [chapters, setChapters] = useState<DetectedChapter[]>([]);
  const [mode, setMode] = useState<ChapterMode>("audio");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const selectedAsset = useMemo(() => assets.find((asset) => asset.id === bookId) ?? null, [assets, bookId]);
  const detectedFor = (asset: AccountLocalBookAsset) => detectChapters(asset.text, 80, false);
  const audioFor = (asset: AccountLocalBookAsset) => chaptersFromAudioChunks(asset.audioChunks.length);

  const applyMode = (asset: AccountLocalBookAsset, nextMode: ChapterMode) => {
    setMode(nextMode);
    if (nextMode === "audio") {
      const generated = audioFor(asset);
      setChapters(generated);
      setMessage(generated.length
        ? `${generated.length} bab dibuat otomatis dari bagian audio. Nama bab tetap dapat diubah sebelum disimpan.`
        : "Buku ini belum memiliki bagian audio lokal. Gunakan mode manual atau buat audionya terlebih dahulu.");
      return;
    }
    setChapters(readCustomChapters(userId, asset.id) ?? detectedFor(asset));
    setMessage("");
  };

  const loadBooks = useCallback(async () => {
    setLoading(true);
    try {
      const records = await listLocalBooks();
      setAssets(records);
      const nextId = records.some((asset) => asset.id === bookId) ? bookId : records[0]?.id ?? "";
      setBookId(nextId);
      const asset = records.find((item) => item.id === nextId);
      if (asset) {
        const saved = readCustomChapters(userId, asset.id);
        if (saved?.some((chapter) => chapter.id.startsWith("audio-chapter-"))) {
          setMode("audio");
          setChapters(saved);
        } else {
          setMode("manual");
          setChapters(saved ?? detectedFor(asset));
        }
      } else {
        setChapters([]);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Daftar bab gagal dimuat.");
    } finally {
      setLoading(false);
    }
  }, [bookId, userId]);

  useEffect(() => {
    const task = window.setTimeout(() => void loadBooks(), 0);
    return () => window.clearTimeout(task);
  }, [loadBooks]);

  const selectBook = (nextId: string) => {
    setBookId(nextId);
    const asset = assets.find((item) => item.id === nextId);
    if (!asset) {
      setChapters([]);
      return;
    }
    const saved = readCustomChapters(userId, asset.id);
    if (saved?.some((chapter) => chapter.id.startsWith("audio-chapter-"))) {
      setMode("audio");
      setChapters(saved);
    } else {
      setMode("manual");
      setChapters(saved ?? detectedFor(asset));
    }
    setMessage("");
  };

  const updateChapter = (id: string, patch: Partial<DetectedChapter>) => {
    setChapters((current) => normalizeChapters(current.map((chapter) => chapter.id === id ? { ...chapter, ...patch } : chapter)));
  };

  const addChapter = () => {
    const previous = chapters.at(-1);
    const progress = previous ? Math.min(1, previous.progress + 0.05) : 0;
    setChapters((current) => normalizeChapters([...current, {
      id: crypto.randomUUID(),
      title: `Bab ${current.length + 1}`,
      progress,
    }]));
  };

  const removeChapter = (id: string) => {
    setChapters((current) => current.filter((chapter) => chapter.id !== id));
  };

  const save = () => {
    if (!selectedAsset) return;
    const saved = writeCustomChapters(userId, selectedAsset.id, chapters);
    setChapters(saved);
    setMessage(`${saved.length} bab disimpan untuk “${selectedAsset.book.title}”. Buka ulang buku pada player untuk memuat daftar terbaru.`);
  };

  const reset = () => {
    if (!selectedAsset) return;
    clearCustomChapters(userId, selectedAsset.id);
    if (mode === "audio") {
      const generated = audioFor(selectedAsset);
      setChapters(generated);
      setMessage(`${generated.length} bab dibuat ulang dari bagian audio.`);
    } else {
      const detected = detectedFor(selectedAsset);
      setChapters(detected);
      setMessage(`Penanda manual dihapus. ${detected.length} bab dideteksi ulang dari teks.`);
    }
  };

  return (
    <div className="settings-section chapter-management">
      <div className="settings-section-head">
        <div>
          <h3>Manajemen bab</h3>
          <p>Pilih pembuatan bab otomatis dari bagian audio atau kelola penanda bab secara manual.</p>
        </div>
        <button className="preview-button" onClick={() => void loadBooks()} disabled={loading}>
          <RefreshCw className={loading ? "spin" : ""} size={16} /> Muat ulang
        </button>
      </div>

      {!assets.length && !loading ? (
        <div className="chapter-empty"><BookOpenText size={24} /><p>Belum ada buku lokal yang dapat dikelola.</p></div>
      ) : (
        <>
          <label className="chapter-book-select">
            <span>Pilih buku</span>
            <select value={bookId} onChange={(event) => selectBook(event.target.value)}>
              {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.book.title}</option>)}
            </select>
          </label>

          <div className="chapter-mode-options" role="radiogroup" aria-label="Mode pembuatan bab">
            <button
              type="button"
              className={mode === "audio" ? "active" : ""}
              onClick={() => selectedAsset && applyMode(selectedAsset, "audio")}
              disabled={!selectedAsset}
            >
              <strong>Otomatis dari audio</strong>
              <span>Satu bab untuk setiap bagian audio yang sudah tersimpan.</span>
            </button>
            <button
              type="button"
              className={mode === "manual" ? "active" : ""}
              onClick={() => selectedAsset && applyMode(selectedAsset, "manual")}
              disabled={!selectedAsset}
            >
              <strong>Manual</strong>
              <span>Deteksi dari teks lalu tambah, hapus, atau atur sendiri.</span>
            </button>
          </div>

          <div className="chapter-editor-list">
            {chapters.map((chapter, index) => (
              <div className="chapter-editor-row" key={chapter.id}>
                <span className="chapter-number">{index + 1}</span>
                <input
                  value={chapter.title}
                  maxLength={100}
                  onChange={(event) => updateChapter(chapter.id, { title: event.target.value })}
                  aria-label={`Nama bab ${index + 1}`}
                />
                <label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={Math.round(chapter.progress * 1000) / 10}
                    onChange={(event) => updateChapter(chapter.id, { progress: Number(event.target.value) / 100 })}
                    aria-label={`Posisi bab ${index + 1}`}
                    disabled={mode === "audio"}
                  />
                  <span>%</span>
                </label>
                <button onClick={() => removeChapter(chapter.id)} aria-label={`Hapus ${chapter.title}`} disabled={mode === "audio"}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>

          {!chapters.length && <p className="chapter-empty-copy">{mode === "audio" ? "Belum ada bagian audio lokal untuk dibuat menjadi bab." : "Bab belum terdeteksi. Tambahkan penanda pertama secara manual."}</p>}

          <div className="chapter-management-actions">
            {mode === "manual" && <button className="preview-button" onClick={addChapter}><Plus size={16} /> Tambah bab</button>}
            <button className="preview-button" onClick={reset} disabled={!selectedAsset}><RotateCcw size={16} /> {mode === "audio" ? "Buat ulang dari audio" : "Deteksi ulang"}</button>
            <button className="dark-button" onClick={save} disabled={!selectedAsset || !chapters.length}><Save size={16} /> Simpan perubahan</button>
          </div>
        </>
      )}

      {message && <p className="catalog-message">{message}</p>}
    </div>
  );
}
