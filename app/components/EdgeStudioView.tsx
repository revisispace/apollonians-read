"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, FileAudio, FileText, Globe2, Link2, LockKeyhole, Pause, Play, RefreshCw, RotateCw, ShieldCheck, Sparkles, Trash2, UploadCloud, WandSparkles, XCircle } from "lucide-react";
import type { Book } from "../lib/content";
import { parseBookFile, parseBookUrl, textChunks } from "../lib/document-parser";
import { appendAudioChunk, getLocalBook, listLocalBooks, saveAudioChunks, saveLocalBook } from "../lib/local-db";
import { generateIndonesianAudio } from "../lib/piper";
import { generateEdgeAudio, getEdgeHealth, listEdgeVoices, previewEdgeVoice, type EdgeVoice } from "../lib/edge-tts";
import { getAppSettings } from "../lib/admin";
import { finishUsage, getQuotaInfo, reserveUsage, type QuotaInfo } from "../lib/usage";
import { enqueueAudiobook, readAudiobookQueue, writeAudiobookQueue, type AudiobookQueueItem, type AudiobookQueueState } from "../lib/audiobook-queue";

type CreateMode = "link" | "file";
type Engine = "edge" | "piper";
const accepted = ".pdf,.epub,.docx,.txt,.md";
const emptyQueue: AudiobookQueueState = { paused: false, items: [] };
const formatCharacters = (value: number) => value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}jt` : value >= 1_000 ? `${Math.round(value / 1_000)}rb` : String(value);
const maximumForQuality = (quality: string) => quality === "Cuplikan cepat" ? 4 : quality === "Bab awal" ? 24 : null;
const statusLabel = (item: AudiobookQueueItem) => item.status === "running" ? "Sedang diproses" : item.status === "queued" ? "Menunggu" : item.status === "done" ? "Selesai" : "Gagal";

export function EdgeStudioView({ onCreated, userId }: { onCreated: (book: Book) => void | Promise<void>; userId: string }) {
  const [mode, setMode] = useState<CreateMode>("file");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [engine, setEngine] = useState<Engine>("edge");
  const [voices, setVoices] = useState<EdgeVoice[]>([]);
  const [voice, setVoice] = useState("Ryan");
  const [quality, setQuality] = useState("Cuplikan cepat");
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("Memeriksa layanan Edge TTS…");
  const [progress, setProgress] = useState(0);
  const [edgeEnabled, setEdgeEnabled] = useState(false);
  const [edgeOnline, setEdgeOnline] = useState(false);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [queue, setQueue] = useState<AudiobookQueueState>(emptyQueue);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLAudioElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const processingRef = useRef<string | null>(null);

  useEffect(() => {
    setQueue(readAudiobookQueue(userId));
  }, [userId]);

  useEffect(() => {
    let active = true;
    Promise.all([getAppSettings(), getQuotaInfo(), getEdgeHealth().catch(() => null)]).then(async ([settings, quotaInfo, health]) => {
      if (!active) return;
      const enabled = settings.edge_tts_enabled;
      setEdgeEnabled(enabled); setQuota(quotaInfo); setEdgeOnline(Boolean(health?.ok));
      if (!enabled || !health?.ok) {
        setEngine("piper");
        setMessage(enabled ? "Server Edge TTS belum dapat dijangkau. Piper lokal dipilih." : "Edge TTS dinonaktifkan oleh superadmin. Piper lokal dipilih.");
        return;
      }
      const availableVoices = await listEdgeVoices();
      if (!active) return;
      setVoices(availableVoices);
      const supportedDefault = availableVoices.find((item) => item.id === "Ryan") ?? availableVoices[0];
      if (supportedDefault) setVoice(supportedDefault.id);
      setMessage("Edge TTS siap digunakan.");
    }).catch(() => { if (active) { setEngine("piper"); setMessage("Layanan server tidak tersedia. Piper lokal tetap dapat digunakan."); } });
    return () => { active = false; if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current); };
  }, []);

  const persistQueue = (next: AudiobookQueueState) => { setQueue(next); writeAudiobookQueue(userId, next); };
  const patchQueueItem = (id: string, patch: Partial<AudiobookQueueItem>) => setQueue((current) => {
    const next = { ...current, items: current.items.map((item) => item.id === id ? { ...item, ...patch, updatedAt: Date.now() } : item) };
    writeAudiobookQueue(userId, next);
    return next;
  });

  useEffect(() => {
    if (!userId || queue.paused || processingRef.current) return;
    const nextItem = queue.items.find((item) => item.status === "queued");
    if (!nextItem) return;
    processingRef.current = nextItem.id;
    patchQueueItem(nextItem.id, { status: "running", error: undefined, progress: Math.max(2, nextItem.progress) });

    const run = async () => {
      try {
        const asset = await getLocalBook(nextItem.bookId);
        if (!asset?.text) throw new Error("Teks sumber antrean tidak ditemukan di perangkat.");
        const maximumChunks = nextItem.maximumChunks ?? Number.POSITIVE_INFINITY;
        const reportProgress = (value: { phase: "model" | "audio"; completed: number; total: number }) => {
          const nextProgress = value.phase === "model" ? Math.max(5, value.total ? Math.round((value.completed / value.total) * 30) : 10) : 30 + Math.round((value.completed / Math.max(1, value.total)) * 70);
          patchQueueItem(nextItem.id, { progress: nextProgress, completedParts: value.phase === "audio" ? value.completed : 0, totalParts: value.phase === "audio" ? value.total : 0 });
        };
        const result = nextItem.engine === "edge"
          ? await generateEdgeAudio(asset.text, { voice: nextItem.voice }, reportProgress, maximumChunks, nextItem.bookId, asset.audioChunks.length, (chunk) => appendAudioChunk(nextItem.bookId, chunk))
          : await generateIndonesianAudio(asset.text, reportProgress, maximumChunks);

        if (nextItem.engine === "edge") {
          const saved = await getLocalBook(nextItem.bookId);
          if (!saved) throw new Error("Audio selesai, tetapi buku lokal tidak ditemukan.");
          saved.book.generated = saved.audioChunks.length > 0;
          saved.updatedAt = new Date().toISOString();
          await saveLocalBook(saved);
          await onCreated(saved.book);
        } else {
          const saved = await saveAudioChunks(nextItem.bookId, result.chunks);
          const processedCharacters = textChunks(asset.text).slice(0, maximumChunks).reduce((sum, item) => sum + item.length, 0);
          const reservation = await reserveUsage(processedCharacters, "piper", nextItem.bookId).catch(() => null);
          await finishUsage(reservation?.id ?? null, true).catch(() => undefined);
          await onCreated(saved.book);
        }
        patchQueueItem(nextItem.id, { status: "done", progress: 100, error: undefined });
        setMessage(result.truncated ? `Cuplikan “${nextItem.title}” selesai.` : `Audiobook “${nextItem.title}” selesai.`);
        setStatus("done");
        setQuota(await getQuotaInfo().catch(() => quota));
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Buku gagal diproses.";
        patchQueueItem(nextItem.id, { status: "error", error: reason });
        setStatus("error"); setMessage(`${reason} Bagian yang sudah selesai tetap tersimpan.`);
      } finally {
        processingRef.current = null;
        setQueue((current) => ({ ...current }));
      }
    };
    void run();
  }, [onCreated, queue, quota, userId]);

  const selectedVoice = useMemo(() => voices.find((item) => item.id === voice), [voice, voices]);
  const activeQueueItem = queue.items.find((item) => item.status === "running");
  const pendingCount = queue.items.filter((item) => item.status === "queued" || item.status === "running").length;

  const handleFile = (incoming?: File) => {
    if (!incoming) return;
    const extension = `.${incoming.name.split(".").pop()?.toLowerCase()}`;
    if (!accepted.split(",").includes(extension) || incoming.size > 50 * 1024 * 1024) { setStatus("error"); setMessage("Gunakan PDF, EPUB, DOCX, TXT, atau MD maksimal 50 MB."); return; }
    setFile(incoming); setStatus("idle"); setMessage(`${incoming.name} siap dimasukkan ke antrean.`);
  };

  const playPreview = async () => {
    if (engine !== "edge" || !previewRef.current) return;
    if (previewing) { previewRef.current.pause(); setPreviewing(false); return; }
    setPreviewing(true);
    try {
      const blob = await previewEdgeVoice({ voice });
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = URL.createObjectURL(blob);
      previewRef.current.src = previewUrlRef.current;
      previewRef.current.onended = () => setPreviewing(false);
      previewRef.current.onpause = () => setPreviewing(false);
      await previewRef.current.play();
    } catch (error) { setPreviewing(false); setStatus("error"); setMessage(error instanceof Error ? error.message : "Preview suara gagal."); }
  };

  const addToQueue = async () => {
    if ((mode === "file" && !file) || (mode === "link" && !url.trim())) { setStatus("error"); setMessage(mode === "file" ? "Pilih file buku terlebih dahulu." : "Masukkan tautan HTTPS terlebih dahulu."); return; }
    if (mode === "link") { try { const parsedUrl = new URL(url); if (parsedUrl.protocol !== "https:") throw new Error(); } catch { setStatus("error"); setMessage("Masukkan tautan HTTPS yang valid."); return; } }
    setStatus("working"); setProgress(2); setMessage("Membaca teks dan menyiapkan item antrean…");
    try {
      const parsed = mode === "file" && file ? await parseBookFile(file) : await parseBookUrl(url.trim());
      const sourceKey = mode === "file" && file ? file.name : url.trim();
      const existingAssets = await listLocalBooks();
      const existing = existingAssets.find((item) => item.book.sourceName === sourceKey || item.book.sourceName === parsed.sourceName);
      const id = existing?.id ?? crypto.randomUUID();
      const wordCount = parsed.text.split(/\s+/).length;
      const minutes = Math.max(1, Math.ceil(wordCount / 155));
      const book: Book = existing?.book ?? { id, title: parsed.title, author: parsed.author, category: "Buku pribadi", duration: minutes >= 60 ? `${Math.floor(minutes / 60)}j ${minutes % 60}m` : `${minutes}m`, remaining: "Belum dimulai", progress: 0, palette: ["ochre", "coral", "navy", "sage", "plum"][Date.now() % 5], sourceName: sourceKey, createdAt: new Date().toISOString(), localOnly: true, generated: false };
      await saveLocalBook({ id, book, text: parsed.text, source: file ?? existing?.source, audioChunks: existing?.audioChunks ?? [], updatedAt: new Date().toISOString() });
      await onCreated(book);
      const item: AudiobookQueueItem = { id: crypto.randomUUID(), bookId: id, title: book.title, sourceName: sourceKey, engine, voice, quality, maximumChunks: maximumForQuality(quality), status: "queued", progress: 0, completedParts: 0, totalParts: 0, createdAt: Date.now(), updatedAt: Date.now() };
      const next = enqueueAudiobook(userId, item);
      setQueue(next); setStatus("done"); setProgress(0); setMessage(`“${book.title}” ditambahkan ke antrean.`);
      setFile(null); setUrl("");
    } catch (error) { setStatus("error"); setMessage(error instanceof Error ? error.message : "Buku gagal disiapkan untuk antrean."); }
  };

  const retryItem = (id: string) => patchQueueItem(id, { status: "queued", progress: 0, completedParts: 0, totalParts: 0, error: undefined });
  const removeItem = (id: string) => persistQueue({ ...queue, items: queue.items.filter((item) => item.id !== id) });
  const togglePause = () => persistQueue({ ...queue, paused: !queue.paused });

  return <div className="view studio-view">
    <audio ref={previewRef} hidden />
    <div className="studio-intro"><p className="eyebrow">STUDIO AUDIO</p><h1>Ubah bacaan menjadi <em>pengalaman.</em></h1><p>Tambahkan beberapa buku; antrean memprosesnya satu per satu dan tetap tersimpan setelah reload.</p></div>
    <div className="studio-layout">
      <section className="creator-card">
        <div className="step-heading"><span>01</span><div><h3>Pilih sumber buku</h3><p>Pastikan kamu memiliki izin untuk memproses kontennya.</p></div></div>
        <div className="source-tabs"><button className={mode === "file" ? "active" : ""} onClick={() => setMode("file")}><UploadCloud size={18}/> Unggah file</button><button className={mode === "link" ? "active" : ""} onClick={() => setMode("link")}><Link2 size={18}/> Dari tautan</button></div>
        {mode === "link" ? <div className="url-panel"><Globe2 size={21}/><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://contoh.com/buku-atau-artikel"/><span>HTTPS</span></div> : <button className={`drop-zone${file ? " has-file" : ""}`} onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); handleFile(event.dataTransfer.files[0]); }}><input ref={inputRef} type="file" accept={accepted} hidden onChange={(event) => handleFile(event.target.files?.[0])}/>{file ? <><span className="upload-icon"><FileText size={25}/></span><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(1)} MB · Siap diantrekan</small><span className="change-file">Ganti file</span></> : <><span className="upload-icon"><UploadCloud size={25}/></span><strong>Letakkan file buku di sini</strong><small>atau klik untuk memilih dari perangkat</small><span className="file-types">PDF · EPUB · DOCX · TXT · MD &nbsp; Maks. 50 MB</span></>}</button>}
        <div className="step-heading second"><span>02</span><div><h3>Atur suara</h3><p>Pengaturan disimpan pada setiap item antrean.</p></div></div>
        <div className="setting-grid"><label>Mesin audio<select value={engine} onChange={(event) => setEngine(event.target.value as Engine)}><option value="edge" disabled={!edgeEnabled || !edgeOnline}>Edge TTS online</option><option value="piper">Piper lokal</option></select></label>{engine === "edge" ? <label>Suara<select value={voice} onChange={(event) => setVoice(event.target.value)}>{voices.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label> : <label>Suara<select disabled><option>Piper News ID</option></select></label>}<label>Mode proses<select value={quality} onChange={(event) => setQuality(event.target.value)}><option>Cuplikan cepat</option><option>Bab awal</option><option>Buku penuh</option></select></label></div>
        {engine === "edge" && <div className="setting-grid"><button className="preview-button" onClick={playPreview}><Play size={16}/> {previewing ? "Jeda preview" : `Preview ${selectedVoice?.name ?? "Ryan"}`}</button></div>}
        <div className="estimate-row"><Clock3 size={17}/><span>{engine === "edge" ? "Diproses oleh server TTS yang sudah ada" : "Diproses di browser"}</span><strong>{quality === "Buku penuh" ? "Tergantung panjang buku" : quality === "Bab awal" ? "± 5–20 menit" : "± 1–5 menit"}</strong></div>
        {status === "working" && <div className="conversion-progress" aria-label={`Progres ${progress}%`}><span style={{ width: `${progress}%` }}/></div>}
        <div className={`status-message ${status}`}>{status === "working" && <RefreshCw size={18} className="spin"/>}{status === "done" && <CheckCircle2 size={18}/>} {status === "error" && <XCircle size={18}/>}<span>{message}</span></div>
        {quota && engine === "edge" && <div className="quota-indicator"><div className="quota-head"><span>Kuota Edge TTS hari ini</span><strong>{formatCharacters(quota.remaining)} / {formatCharacters(quota.dailyLimit)} tersisa</strong></div><div className="quota-track"><span style={{ width: `${Math.min(100, quota.percentUsed)}%` }}/></div></div>}
        <button className="generate-button" disabled={status === "working"} onClick={addToQueue}><WandSparkles size={19}/> {status === "working" ? "Menyiapkan buku…" : "Tambahkan ke antrean"} <ArrowRight size={18}/></button>
        <p className="secure-note"><LockKeyhole size={14}/> {engine === "edge" ? "Permintaan wajib login dan memakai kontrak server yang sudah berjalan." : "Piper berjalan lokal; teks tidak dikirim ke server TTS."}</p>
      </section>

      <aside className="studio-aside">
        <section className="queue-card"><div className="queue-head"><div><p className="eyebrow">ANTREAN AUDIOBOOK</p><h3>{pendingCount ? `${pendingCount} proses aktif` : "Tidak ada proses aktif"}</h3></div><button onClick={togglePause} disabled={!pendingCount}>{queue.paused ? <><Play size={16}/> Lanjutkan</> : <><Pause size={16}/> Jeda antrean</>}</button></div>{activeQueueItem && <div className="queue-active"><strong>{activeQueueItem.title}</strong><small>{activeQueueItem.completedParts && activeQueueItem.totalParts ? `Bagian ${activeQueueItem.completedParts}/${activeQueueItem.totalParts}` : "Menyiapkan audio"}</small><div><span style={{ width: `${activeQueueItem.progress}%` }}/></div></div>}<div className="queue-list">{queue.items.map((item) => <article key={item.id} className={`queue-item ${item.status}`}><div><strong>{item.title}</strong><small>{item.engine === "edge" ? `Edge · ${item.voice}` : "Piper lokal"} · {item.quality}</small>{item.error && <p>{item.error}</p>}</div><span>{statusLabel(item)} · {item.progress}%</span><div>{item.status === "error" && <button onClick={() => retryItem(item.id)}><RotateCw size={14}/> Coba lagi</button>}{item.status !== "running" && <button onClick={() => removeItem(item.id)} aria-label="Hapus dari antrean"><Trash2 size={14}/></button>}</div></article>)}{!queue.items.length && <p className="queue-empty">Buku yang ditambahkan akan muncul di sini dan diproses berurutan.</p>}</div></section>
        <div className="how-card"><p className="eyebrow">CARA KERJA</p>{[[FileText,"Baca & simpan","Teks dibersihkan lalu disimpan privat sebelum masuk antrean."],[Sparkles,"Proses berurutan","Hanya satu buku diproses pada satu waktu."],[FileAudio,"Pulih otomatis","Antrean dan audio yang selesai tetap tersedia setelah reload."]].map(([Icon,title,copy],index)=>{const IconComponent=Icon as typeof FileText;return <div className="how-row" key={String(title)}><span><IconComponent size={18}/></span><div><small>0{index+1}</small><h4>{String(title)}</h4><p>{String(copy)}</p></div></div>;})}</div>
        <div className="copyright-card"><ShieldCheck size={21}/><div><h4>Hak cipta tetap milikmu</h4><p>Gunakan hanya buku yang kamu beli, tulis, atau punya izin untuk mengonversinya.</p></div></div>
      </aside>
    </div>
  </div>;
}
