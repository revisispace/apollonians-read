"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpenText, Plus, RefreshCw, RotateCcw, Save, Trash2 } from "lucide-react";
import { clearCustomChapters, readCustomChapters, writeCustomChapters } from "../lib/account-storage";
import { detectChapters, normalizeChapters, type DetectedChapter } from "../lib/chapters";
import { listLocalBooks, type AccountLocalBookAsset } from "../lib/local-db";

export function ChapterManagement({ userId }: { userId: string }) {
  const [assets, setAssets] = useState<AccountLocalBookAsset[]>([]);
  const [bookId, setBookId] = useState("");
  const [chapters, setChapters] = useState<DetectedChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const selectedAsset = useMemo(() => assets.find((asset) => asset.id === bookId) ?? null, [assets, bookId]);

  const loadBooks = useCallback(async () => {
    setLoading(true);
    try {
      const records = await listLocalBooks();
      setAssets(records);
      const nextId = records.some((asset) => asset.id === bookId) ? bookId : records[0]?.id ?? "";
      setBookId(nextId);
      const asset = records.find((item) => item.id === nextId);
      if (asset) {
        setChapters(readCustomChapters(userId, asset.id) ?? detectChapters(asset.text));
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
    setChapters(asset ? readCustomChapters(userId, asset.id) ?? detectChapters(asset.text) : []);
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
    setMessage(`${saved.length} penanda bab disimpan untuk “${selectedAsset.book.title}”. Buka ulang buku pada player untuk memuat daftar terbaru.`);
  };

  const reset = () => {
    if (!selectedAsset) return;
    clearCustomChapters(userId, selectedAsset.id);
    const detected = detectChapters(selectedAsset.text);
    setChapters(detected);
    setMessage(`Penanda manual dihapus. ${detected.length} bab dideteksi ulang dari teks.`);
  };

  return (
    <div className="settings-section chapter-management">
      <div className="settings-section-head">
        <div>
          <h3>Manajemen bab</h3>
          <p>Ubah nama, tambah, atau hapus penanda bab. Posisi memakai persentase keseluruhan buku.</p>
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
                  />
                  <span>%</span>
                </label>
                <button onClick={() => removeChapter(chapter.id)} aria-label={`Hapus ${chapter.title}`}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>

          {!chapters.length && <p className="chapter-empty-copy">Bab belum terdeteksi. Tambahkan penanda pertama secara manual.</p>}

          <div className="chapter-management-actions">
            <button className="preview-button" onClick={addChapter}><Plus size={16} /> Tambah bab</button>
            <button className="preview-button" onClick={reset} disabled={!selectedAsset}><RotateCcw size={16} /> Deteksi ulang</button>
            <button className="dark-button" onClick={save} disabled={!selectedAsset}><Save size={16} /> Simpan perubahan</button>
          </div>
        </>
      )}

      {message && <p className="catalog-message">{message}</p>}
    </div>
  );
}
