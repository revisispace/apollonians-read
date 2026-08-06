"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Pause, Play, RefreshCw } from "lucide-react";
import { generateIndonesianAudio } from "../lib/piper";
import {
  readAccountPreferences,
  writeAccountPreferences,
  type AccountPreferences,
} from "../lib/account-storage";
import { StorageManagement } from "./StorageManagement";

export function AccountSettingsView({
  userId,
  onAudioRemoved,
}: {
  userId: string;
  onAudioRemoved: (bookIds: string[], removedBytes: number) => void;
}) {
  const [prefs, setPrefs] = useState<AccountPreferences>(() => readAccountPreferences(userId));
  const [previewState, setPreviewState] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    };
  }, []);

  const update = (key: keyof AccountPreferences, value: boolean) => {
    setPrefs((current) => {
      const next = { ...current, [key]: value };
      writeAccountPreferences(userId, next);
      return next;
    });
  };

  const previewVoice = async () => {
    const audio = document.querySelector<HTMLAudioElement>("#piper-preview");
    if (!audio) return;

    if (previewState === "playing") {
      audio.pause();
      setPreviewState("idle");
      return;
    }

    setPreviewState("loading");
    try {
      const result = await generateIndonesianAudio(
        "Halo, ini adalah contoh suara narator open-source untuk Apollonians Read.",
        undefined,
        1,
      );

      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = URL.createObjectURL(result.chunks[0]);
      audio.src = previewUrlRef.current;
      audio.onplay = () => setPreviewState("playing");
      audio.onpause = () => setPreviewState("idle");
      audio.onended = () => setPreviewState("idle");
      audio.onerror = () => setPreviewState("error");
      await audio.play();
    } catch {
      setPreviewState("error");
    }
  };

  return (
    <div className="view settings-view">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">PREFERENSI</p>
          <h1>Pengaturan</h1>
          <p>Perubahan tersimpan khusus untuk akun aktif pada perangkat ini.</p>
        </div>
      </div>

      <div className="settings-layout">
        <section className="settings-panel">
          <div className="settings-section">
            <div className="settings-section-head">
              <div>
                <h3>Piper Bahasa Indonesia</h3>
                <p>Model open-source berjalan lokal. Unduhan pertama sekitar 63 MB.</p>
              </div>
              <button className="preview-button" onClick={previewVoice}>
                {previewState === "loading" ? (
                  <RefreshCw className="spin" size={16} />
                ) : previewState === "playing" ? (
                  <Pause size={16} />
                ) : (
                  <Play size={16} fill="currentColor" />
                )}
                {previewState === "playing" ? "Jeda" : "Dengar contoh"}
              </button>
            </div>

            {previewState === "error" && (
              <p className="inline-warning">
                Model gagal dimuat. Pastikan memakai Chrome atau Edge terbaru dan koneksi tersedia saat unduhan pertama.
              </p>
            )}

            <audio id="piper-preview" hidden />
            <div className="voice-options">
              <button className="active">
                <span className="voice-wave">▂▅▃▂</span>
                <strong>News TTS ID</strong>
                <small>Piper · ONNX lokal</small>
                <CheckCircle2 size={17} />
              </button>
            </div>
          </div>

          <div className="settings-section">
            <h3>Pemutaran & hasil</h3>
            <ToggleRow
              title="Normalisasi volume"
              copy="Seimbangkan volume antar bab secara otomatis."
              enabled={prefs.normalize}
              onChange={(value) => update("normalize", value)}
            />
            <ToggleRow
              title="Unduh otomatis"
              copy="Simpan audio baru untuk didengarkan offline."
              enabled={prefs.autoDownload}
              onChange={(value) => update("autoDownload", value)}
            />
            <ToggleRow
              title="Notifikasi selesai"
              copy="Beri tahu ketika audiobook siap didengar."
              enabled={prefs.notify}
              onChange={(value) => update("notify", value)}
            />
          </div>

          <StorageManagement onAudioRemoved={onAudioRemoved} />
        </section>
      </div>
    </div>
  );
}

function ToggleRow({
  title,
  copy,
  enabled,
  onChange,
}: {
  title: string;
  copy: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="toggle-row">
      <div>
        <strong>{title}</strong>
        <p>{copy}</p>
      </div>
      <button
        className={`toggle ${enabled ? "on" : ""}`}
        onClick={() => onChange(!enabled)}
        aria-label={`${title}: ${enabled ? "aktif" : "nonaktif"}`}
      >
        <span />
      </button>
    </div>
  );
}
