"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileAudio,
  FileText,
  Globe2,
  Link2,
  LockKeyhole,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  WandSparkles,
  XCircle,
} from "lucide-react";
import type { Book } from "../lib/content";
import { parseBookFile, parseBookUrl, textChunks } from "../lib/document-parser";
import {
  appendAudioChunk,
  getLocalBook,
  listLocalBooks,
  saveAudioChunks,
  saveLocalBook,
} from "../lib/local-db";
import { generateIndonesianAudio } from "../lib/piper";
import {
  generateEdgeAudio,
  getEdgeHealth,
  listEdgeVoices,
  previewEdgeVoice,
  type EdgeVoice,
} from "../lib/edge-tts";
import { getAppSettings } from "../lib/admin";
import { finishUsage, getQuotaInfo, reserveUsage, type QuotaInfo } from "../lib/usage";

type CreateMode = "link" | "file";
type Engine = "edge" | "piper";

const accepted = ".pdf,.epub,.docx,.txt,.md";

const formatCharacters = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}jt`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}rb`;
  return String(value);
};

export function EdgeStudioView({ onCreated }: { onCreated: (book: Book) => void | Promise<void> }) {
  const [mode, setMode] = useState<CreateMode>("file");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [engine, setEngine] = useState<Engine>("edge");
  const [voices, setVoices] = useState<EdgeVoice[]>([]);
  const [voice, setVoice] = useState("id-ID-ArdiNeural");
  const [rate, setRate] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [volume, setVolume] = useState(0);
  const [quality, setQuality] = useState("Cuplikan cepat");
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("Memeriksa layanan Edge TTS…");
  const [progress, setProgress] = useState(0);
  const [edgeEnabled, setEdgeEnabled] = useState(false);
  const [edgeOnline, setEdgeOnline] = useState(false);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLAudioElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([getAppSettings(), getQuotaInfo(), getEdgeHealth().catch(() => null)])
      .then(async ([settings, quotaInfo, health]) => {
        if (!active) return;
        const enabled = settings.edge_tts_enabled;
        setEdgeEnabled(enabled);
        setQuota(quotaInfo);
        setEdgeOnline(Boolean(health?.ok));
        if (!enabled || !health?.ok) {
          setEngine("piper");
          setMessage(enabled ? "Server Edge TTS belum dapat dijangkau. Piper lokal dipilih." : "Edge TTS dinonaktifkan oleh superadmin. Piper lokal dipilih.");
          return;
        }
        const availableVoices = await listEdgeVoices();
        if (!active) return;
        setVoices(availableVoices);
        const indonesian = availableVoices.find((item) => item.locale.startsWith("id-"));
        if (indonesian) setVoice(indonesian.id);
        setMessage("Edge TTS siap digunakan.");
      })
      .catch(() => {
        if (!active) return;
        setEngine("piper");
        setMessage("Layanan server tidak tersedia. Piper lokal tetap dapat digunakan.");
      });

    return () => {
      active = false;
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const selectedVoice = useMemo(() => voices.find((item) => item.id === voice), [voice, voices]);

  const handleFile = (incoming?: File) => {
    if (!incoming) return;
    const extension = `.${incoming.name.split(".").pop()?.toLowerCase()}`;
    if (!accepted.split(",").includes(extension) || incoming.size > 50 * 1024 * 1024) {
      setStatus("error");
      setMessage("Gunakan PDF, EPUB, DOCX, TXT, atau MD maksimal 50 MB.");
      return;
    }
    setFile(incoming);
    setStatus("idle");
    setMessage(`${incoming.name} siap diproses.`);
  };

  const playPreview = async () => {
    if (engine !== "edge") return;
    const audio = previewRef.current;
    if (!audio) return;
    if (previewing) {
      audio.pause();
      setPreviewing(false);
      return;
    }

    setPreviewing(true);
    try {
      const blob = await previewEdgeVoice({ voice, rate, pitch, volume });
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = URL.createObjectURL(blob);
      audio.src = previewUrlRef.current;
      audio.onended = () => setPreviewing(false);
      audio.onpause = () => setPreviewing(false);
      await audio.play();
    } catch (error) {
      setPreviewing(false);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Preview suara gagal.");
    }
  };

  const createAudiobook = async () => {
    if ((mode === "file" && !file) || (mode === "link" && !url.trim())) {
      setStatus("error");
      setMessage(mode === "file" ? "Pilih file buku terlebih dahulu." : "Masukkan tautan HTTPS terlebih dahulu.");
      return;
    }

    if (mode === "link") {
      try {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== "https:") throw new Error();
      } catch {
        setStatus("error");
        setMessage("Masukkan tautan HTTPS yang valid.");
        return;
      }
    }

    setStatus("working");
    setProgress(2);
    setMessage("Membaca dan membersihkan teks buku…");

    try {
      const parsed = mode === "file" && file ? await parseBookFile(file) : await parseBookUrl(url.trim());
      const sourceKey = mode === "file" && file ? file.name : url.trim();
      const existingAssets = await listLocalBooks();
      const existing = existingAssets.find((item) => item.book.sourceName === sourceKey || item.book.sourceName === parsed.sourceName);
      const id = existing?.id ?? crypto.randomUUID();
      const existingChunks = existing?.audioChunks ?? [];
      const wordCount = parsed.text.split(/\s+/).length;
      const minutes = Math.max(1, Math.ceil(wordCount / 155));
      const book: Book = existing?.book ?? {
        id,
        title: parsed.title,
        author: parsed.author,
        category: "Buku pribadi",
        duration: minutes >= 60 ? `${Math.floor(minutes / 60)}j ${minutes % 60}m` : `${minutes}m`,
        remaining: "Belum dimulai",
        progress: 0,
        palette: ["ochre", "coral", "navy", "sage", "plum"][Date.now() % 5],
        sourceName: sourceKey,
        createdAt: new Date().toISOString(),
        localOnly: true,
        generated: false,
      };

      if (!existing) {
        await saveLocalBook({ id, book, text: parsed.text, source: file ?? undefined, audioChunks: [], updatedAt: book.createdAt! });
        await onCreated(book);
      }

      const maximumChunks = quality === "Cuplikan cepat" ? 4 : quality === "Bab awal" ? 24 : Number.POSITIVE_INFINITY;
      const reportProgress = (value: { phase: "model" | "audio"; completed: number; total: number }) => {
        if (value.phase === "model") {
          setProgress(Math.max(5, value.total ? Math.round((value.completed / value.total) * 30) : 10));
        } else {
          setProgress(30 + Math.round((value.completed / value.total) * 70));
          setMessage(`Membuat bagian audio ${value.completed} dari ${value.total}…`);
        }
      };

      const result = engine === "edge"
        ? await generateEdgeAudio(
            parsed.text,
            { voice, rate, pitch, volume },
            reportProgress,
            maximumChunks,
            id,
            existingChunks.length,
            (chunk) => appendAudioChunk(id, chunk),
          )
        : await generateIndonesianAudio(parsed.text, reportProgress, maximumChunks);

      if (engine === "edge") {
        const saved = await getLocalBook(id);
        if (!saved) throw new Error("Audio selesai, tetapi buku lokal tidak ditemukan.");
        saved.book.generated = saved.audioChunks.length > 0;
        saved.updatedAt = new Date().toISOString();
        await saveLocalBook(saved);
        await onCreated(saved.book);
      } else {
        const saved = await saveAudioChunks(id, result.chunks);
        const processedCharacters = textChunks(parsed.text).slice(0, maximumChunks).reduce((sum, item) => sum + item.length, 0);
        const reservation = await reserveUsage(processedCharacters, "piper", id).catch(() => null);
        await finishUsage(reservation?.id ?? null, true).catch(() => undefined);
        await onCreated(saved.book);
      }

      setProgress(100);
      setStatus("done");
      setMessage(result.truncated ? "Cuplikan audio selesai dan tersimpan di perangkat." : "Audiobook selesai dan tersimpan privat di perangkat.");
      setQuota(await getQuotaInfo().catch(() => quota));
    } catch (error) {
      setStatus("error");
      setMessage(`${error instanceof Error ? error.message : "Buku gagal diproses."} Bagian yang sudah selesai tetap tersimpan.`);
    }
  };

  return (
    <div className="view studio-view">
      <audio ref={previewRef} hidden />
      <div className="studio-intro">
        <p className="eyebrow">STUDIO AUDIO</p>
        <h1>Ubah bacaan menjadi <em>pengalaman.</em></h1>
        <p>Edge TTS menjadi suara online utama. Piper tetap tersedia sebagai fallback lokal.</p>
      </div>

      <div className="studio-layout">
        <section className="creator-card">
          <div className="step-heading"><span>01</span><div><h3>Pilih sumber buku</h3><p>Pastikan kamu memiliki izin untuk memproses kontennya.</p></div></div>
          <div className="source-tabs">
            <button className={mode === "file" ? "active" : ""} onClick={() => setMode("file")}><UploadCloud size={18} /> Unggah file</button>
            <button className={mode === "link" ? "active" : ""} onClick={() => setMode("link")}><Link2 size={18} /> Dari tautan</button>
          </div>

          {mode === "link" ? (
            <div className="url-panel"><Globe2 size={21} /><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://contoh.com/buku-atau-artikel" /><span>HTTPS</span></div>
          ) : (
            <button className={`drop-zone${file ? " has-file" : ""}`} onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); handleFile(event.dataTransfer.files[0]); }}>
              <input ref={inputRef} type="file" accept={accepted} hidden onChange={(event) => handleFile(event.target.files?.[0])} />
              {file ? (
                <><span className="upload-icon"><FileText size={25} /></span><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(1)} MB · Siap diproses</small><span className="change-file">Ganti file</span></>
              ) : (
                <><span className="upload-icon"><UploadCloud size={25} /></span><strong>Letakkan file buku di sini</strong><small>atau klik untuk memilih dari perangkat</small><span className="file-types">PDF · EPUB · DOCX · TXT · MD &nbsp; Maks. 50 MB</span></>
              )}
            </button>
          )}

          <div className="step-heading second"><span>02</span><div><h3>Atur suara</h3><p>Pilih suara server natural atau fallback lokal.</p></div></div>
          <div className="setting-grid">
            <label>Mesin audio
              <select value={engine} onChange={(event) => setEngine(event.target.value as Engine)}>
                <option value="edge" disabled={!edgeEnabled || !edgeOnline}>Edge TTS online</option>
                <option value="piper">Piper lokal</option>
              </select>
            </label>
            {engine === "edge" ? (
              <label>Suara
                <select value={voice} onChange={(event) => setVoice(event.target.value)}>
                  {voices.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
            ) : <label>Suara<select disabled><option>Piper News ID</option></select></label>}
            <label>Mode proses<select value={quality} onChange={(event) => setQuality(event.target.value)}><option>Cuplikan cepat</option><option>Bab awal</option><option>Buku penuh</option></select></label>
          </div>

          {engine === "edge" && (
            <div className="setting-grid">
              <label>Kecepatan ({rate > 0 ? "+" : ""}{rate}%)<input type="range" min="-40" max="60" value={rate} onChange={(event) => setRate(Number(event.target.value))} /></label>
              <label>Pitch ({pitch > 0 ? "+" : ""}{pitch}Hz)<input type="range" min="-30" max="30" value={pitch} onChange={(event) => setPitch(Number(event.target.value))} /></label>
              <label>Volume ({volume > 0 ? "+" : ""}{volume}%)<input type="range" min="-50" max="50" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></label>
              <button className="preview-button" onClick={playPreview}><Play size={16} /> {previewing ? "Jeda preview" : `Preview ${selectedVoice?.name ?? "suara"}`}</button>
            </div>
          )}

          <div className="estimate-row"><Clock3 size={17} /><span>{engine === "edge" ? "Diproses di Oracle Free VM" : "Diproses di browser"}</span><strong>{quality === "Buku penuh" ? "Tergantung panjang buku" : quality === "Bab awal" ? "± 5–20 menit" : "± 1–5 menit"}</strong></div>
          {status === "working" && <div className="conversion-progress" aria-label={`Progres ${progress}%`}><span style={{ width: `${progress}%` }} /></div>}
          <div className={`status-message ${status}`}>
            {status === "working" && <RefreshCw size={18} className="spin" />}
            {status === "done" && <CheckCircle2 size={18} />}
            {status === "error" && <XCircle size={18} />}
            <span>{message}</span>
          </div>

          {quota && engine === "edge" && (
            <div className="quota-indicator">
              <div className="quota-head"><span>Kuota Edge TTS hari ini</span><strong>{formatCharacters(quota.remaining)} / {formatCharacters(quota.dailyLimit)} tersisa</strong></div>
              <div className="quota-track"><span style={{ width: `${Math.min(100, quota.percentUsed)}%` }} /></div>
            </div>
          )}

          <button className="generate-button" disabled={status === "working"} onClick={createAudiobook}><WandSparkles size={19} /> {status === "working" ? "Menyiapkan buku…" : "Buat audiobook"} <ArrowRight size={18} /></button>
          <p className="secure-note"><LockKeyhole size={14} /> {engine === "edge" ? "Permintaan wajib login dan dikirim melalui server Apollonians Read." : "Piper berjalan lokal; teks tidak dikirim ke server TTS."}</p>
        </section>

        <aside className="studio-aside">
          <div className="how-card">
            <p className="eyebrow">CARA KERJA</p>
            {[
              [FileText, "Baca & susun", "Teks dibersihkan dan dibagi menjadi bagian aman."],
              [Sparkles, "Narasi natural", "Edge TTS memakai suara Microsoft Edge online."],
              [FileAudio, "Simpan lokal", "Setiap bagian selesai langsung masuk IndexedDB akun."],
            ].map(([Icon, title, copy], index) => {
              const IconComponent = Icon as typeof FileText;
              return <div className="how-row" key={String(title)}><span><IconComponent size={18} /></span><div><small>0{index + 1}</small><h4>{String(title)}</h4><p>{String(copy)}</p></div></div>;
            })}
          </div>
          <div className="copyright-card"><ShieldCheck size={21} /><div><h4>Hak cipta tetap milikmu</h4><p>Gunakan hanya buku yang kamu beli, tulis, atau punya izin untuk mengonversinya.</p></div></div>
        </aside>
      </div>
    </div>
  );
}
