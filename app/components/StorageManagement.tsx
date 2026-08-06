"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Database, HardDrive, RefreshCw, Trash2 } from "lucide-react";
import {
  estimateLocalStorage,
  listLocalStorageSummaries,
  removeLocalAudio,
  type LocalBookStorageSummary,
} from "../lib/local-db";

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
};

type StorageManagementProps = {
  onAudioRemoved: (bookIds: string[], removedBytes: number) => void;
};

export function StorageManagement({ onAudioRemoved }: StorageManagementProps) {
  const [items, setItems] = useState<LocalBookStorageSummary[]>([]);
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const [summaries, storageEstimate] = await Promise.all([
        listLocalStorageSummaries(),
        estimateLocalStorage(),
      ]);
      setItems(summaries);
      setEstimate(storageEstimate);
      setSelected((current) => current.filter((id) => summaries.some((item) => item.id === id && item.audioBytes > 0)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Informasi penyimpanan gagal dimuat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const localTotal = useMemo(() => items.reduce((total, item) => total + item.totalBytes, 0), [items]);
  const audioTotal = useMemo(() => items.reduce((total, item) => total + item.audioBytes, 0), [items]);
  const selectedBytes = useMemo(
    () => items.filter((item) => selected.includes(item.id)).reduce((total, item) => total + item.audioBytes, 0),
    [items, selected],
  );
  const quotaPercent = estimate?.quota ? Math.min(100, Math.round((estimate.usage / estimate.quota) * 100)) : 0;
  const warning = quotaPercent >= 85;

  const toggleSelection = (id: string) => {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const removeAudio = async (ids: string[]) => {
    if (!ids.length || removing) return;
    const bytes = items.filter((item) => ids.includes(item.id)).reduce((total, item) => total + item.audioBytes, 0);
    const label = ids.length === 1 ? "audio buku ini" : `audio dari ${ids.length} buku`;
    if (!window.confirm(`Hapus ${label} dari perangkat dan kosongkan sekitar ${formatBytes(bytes)}? Metadata buku tetap disimpan.`)) return;

    setRemoving(true);
    setMessage("");
    try {
      const removedBytes = await removeLocalAudio(ids);
      onAudioRemoved(ids, removedBytes);
      setSelected((current) => current.filter((id) => !ids.includes(id)));
      setMessage(`${formatBytes(removedBytes)} audio lokal berhasil dihapus. Buku tetap tersedia untuk dibuat ulang.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Audio lokal gagal dihapus.");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="settings-section storage-management">
      <div className="settings-section-head">
        <div>
          <h3>Penyimpanan perangkat</h3>
          <p>Kelola file audio IndexedDB tanpa menghapus buku, teks sumber, atau metadata cloud.</p>
        </div>
        <button className="preview-button" onClick={() => void refresh()} disabled={loading || removing}>
          <RefreshCw className={loading ? "spin" : ""} size={16} /> Segarkan
        </button>
      </div>

      <div className="storage-metrics">
        <article>
          <Database size={18} />
          <div><small>Data aplikasi lokal</small><strong>{formatBytes(localTotal)}</strong></div>
        </article>
        <article>
          <HardDrive size={18} />
          <div><small>Audio yang dapat dibersihkan</small><strong>{formatBytes(audioTotal)}</strong></div>
        </article>
        <article className={warning ? "storage-warning" : ""}>
          <HardDrive size={18} />
          <div><small>Penggunaan perangkat</small><strong>{estimate ? `${formatBytes(estimate.usage)} / ${formatBytes(estimate.quota)}` : "Tidak tersedia"}</strong></div>
        </article>
      </div>

      {estimate?.quota ? (
        <div className="device-storage-track" aria-label={`Penyimpanan perangkat terpakai ${quotaPercent}%`}>
          <span style={{ width: `${quotaPercent}%` }} />
        </div>
      ) : null}
      {warning && <p className="inline-warning">Penyimpanan perangkat hampir penuh. Hapus audio yang sudah diekspor atau tidak lagi dibutuhkan.</p>}

      {selected.length > 0 && (
        <div className="storage-bulk-bar">
          <span>{selected.length} buku · {formatBytes(selectedBytes)}</span>
          <button className="delete-book" onClick={() => void removeAudio(selected)} disabled={removing}>
            <Trash2 size={15} /> Hapus audio terpilih
          </button>
        </div>
      )}

      <div className="storage-book-list">
        {loading ? (
          <p className="storage-empty">Menghitung ukuran penyimpanan…</p>
        ) : items.length === 0 ? (
          <p className="storage-empty">Belum ada buku lokal pada akun ini.</p>
        ) : items.map((item) => (
          <article key={item.id} className={item.audioBytes ? "" : "is-cloud-only"}>
            <label>
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                disabled={!item.audioBytes || removing}
                onChange={() => toggleSelection(item.id)}
              />
              <span>
                <strong>{item.title}</strong>
                <small>{item.audioChunks ? `${item.audioChunks} bagian audio` : "Tanpa audio lokal"} · Total lokal {formatBytes(item.totalBytes)}</small>
              </span>
            </label>
            <div className="storage-book-size">
              <strong>{formatBytes(item.audioBytes)}</strong>
              <button
                className="delete-book"
                disabled={!item.audioBytes || removing}
                onClick={() => void removeAudio([item.id])}
                aria-label={`Hapus audio lokal ${item.title}`}
              >
                <Trash2 size={14} /> Hapus audio
              </button>
            </div>
          </article>
        ))}
      </div>

      {message && <p className="storage-message">{message}</p>}
    </div>
  );
}
