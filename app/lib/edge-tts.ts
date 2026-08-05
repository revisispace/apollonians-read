import { textChunks } from "./document-parser";
import type { TtsProgress } from "./piper";
import { getSupabase } from "./supabase";
import {
  clearActiveEdgeJob,
  readActiveEdgeJob,
  writeActiveEdgeJob,
  type ActiveEdgeJob,
} from "./account-storage";

const endpoint = process.env.NEXT_PUBLIC_QWEN_TTS_ENDPOINT?.trim().replace(/\/$/, "");
export const edgeTtsEndpoint = endpoint ?? "";
export const isEdgeTtsConfigured = Boolean(endpoint);

const SEGMENT_LIMIT = 3000;
const POLL_INTERVAL_MS = 3000;
const REQUEST_TIMEOUT_MS = 30_000;
const JOB_TIMEOUT_MS = 5 * 60_000;
const ACTIVE_JOB_TTL_MS = 30 * 60_000;
const TRANSIENT_RETRIES = 2;

export type EdgeVoice = {
  id: string;
  name: string;
  locale: string;
  gender: "Female" | "Male" | "Unknown";
  label: string;
};

export type EdgeVoiceOptions = {
  voice: string;
  rate?: number;
  pitch?: number;
  volume?: number;
};

type EdgeJobStatus = {
  status: "queued" | "processing" | "done" | "failed";
  error?: string | null;
};

type SessionIdentity = {
  token: string;
  userId: string;
};

type SegmentResult = {
  blob: Blob;
  jobId: string;
  userId: string;
  recovered: boolean;
};

const existingOracleVoices: EdgeVoice[] = [
  { id: "Ryan", name: "Ryan", locale: "en-US", gender: "Male", label: "Ryan · Pria · English US" },
  { id: "Guy", name: "Guy", locale: "en-US", gender: "Male", label: "Guy · Pria · English US" },
  { id: "Davis", name: "Davis", locale: "en-US", gender: "Male", label: "Davis · Pria · English US" },
  { id: "Jenny", name: "Jenny", locale: "en-US", gender: "Female", label: "Jenny · Wanita · English US" },
  { id: "Aria", name: "Aria", locale: "en-US", gender: "Female", label: "Aria · Wanita · English US" },
  { id: "Serena", name: "Serena", locale: "en-US", gender: "Female", label: "Serena · Wanita · English US" },
  { id: "Vivian", name: "Vivian", locale: "en-US", gender: "Female", label: "Vivian · Wanita · English US" },
];

function sleep(milliseconds: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

function mergeIntoSegments(text: string, limit = SEGMENT_LIMIT) {
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  const segments: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const piece = sentence.trim();
    if (!piece) continue;
    if (current && `${current} ${piece}`.length > limit) {
      segments.push(current);
      current = piece;
    } else {
      current = current ? `${current} ${piece}` : piece;
    }
  }

  if (current) segments.push(current);
  return segments;
}

async function getSessionIdentity(): Promise<SessionIdentity> {
  const supabase = getSupabase();
  const { data, error } = (await supabase?.auth.getSession()) ?? { data: { session: null }, error: null };
  if (error) throw error;
  if (!data.session) throw new Error("Masuk ke akun untuk menggunakan Edge TTS.");
  return { token: data.session.access_token, userId: data.session.user.id };
}

async function readError(response: Response) {
  const problem = (await response.json().catch(() => null)) as { detail?: string; error?: string } | null;
  return new Error(problem?.detail ?? problem?.error ?? `Layanan Edge TTS gagal (${response.status}).`);
}

function isTransientStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Permintaan Edge TTS melewati batas waktu. Coba lanjutkan proses; bagian yang sudah selesai tetap tersimpan.");
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

async function authedFetch(token: string, path: string, init?: RequestInit, retries = 0) {
  if (!endpoint) throw new Error("Endpoint Edge TTS belum dikonfigurasi.");
  const request: RequestInit = {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "ngrok-skip-browser-warning": "1",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  };

  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetchWithTimeout(`${endpoint}${path}`, request);
      if (response.ok) return response;
      if (attempt < retries && isTransientStatus(response.status)) {
        await sleep(750 * (attempt + 1));
        continue;
      }
      throw await readError(response);
    } catch (error) {
      if (attempt >= retries || (error instanceof Error && error.message.includes("batas waktu"))) throw error;
      await sleep(750 * (attempt + 1));
    }
  }
}

export async function getEdgeHealth() {
  if (!endpoint) throw new Error("Endpoint Edge TTS belum dikonfigurasi.");
  const response = await fetchWithTimeout(`${endpoint}/health`, { cache: "no-store" });
  if (!response.ok) throw await readError(response);
  return response.json() as Promise<{ ok: boolean; engine?: string; loaded?: boolean }>;
}

export async function listEdgeVoices() {
  return existingOracleVoices;
}

function matchingRecoverableJob(
  userId: string,
  bookId: string,
  segmentIndex: number,
  totalSegments: number,
  voice: string,
) {
  const existing = readActiveEdgeJob(userId, bookId);
  if (!existing) return null;
  const expired = Date.now() - existing.createdAt > ACTIVE_JOB_TTL_MS;
  const matches = existing.segmentIndex === segmentIndex
    && existing.totalSegments === totalSegments
    && existing.voice === voice;
  if (expired || !matches) {
    clearActiveEdgeJob(userId, bookId, existing.jobId);
    return null;
  }
  return existing;
}

async function createJob(
  identity: SessionIdentity,
  text: string,
  voice: string,
  bookId?: string,
  segmentIndex = 0,
  totalSegments = 1,
) {
  const startResponse = await authedFetch(identity.token, "/v1/tts", {
    method: "POST",
    body: JSON.stringify({
      text,
      book_id: bookId ?? null,
      language: "English",
      speaker: voice,
    }),
  });
  const { job_id: jobId } = await startResponse.json() as { job_id: string };
  if (!jobId) throw new Error("Server Edge TTS tidak mengembalikan ID pekerjaan.");

  if (bookId) {
    writeActiveEdgeJob(identity.userId, {
      jobId,
      bookId,
      segmentIndex,
      totalSegments,
      voice,
      createdAt: Date.now(),
    });
  }
  return jobId;
}

async function waitForJob(token: string, job: ActiveEdgeJob | { jobId: string; createdAt: number }) {
  const deadline = Date.now() + JOB_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const statusResponse = await authedFetch(token, `/v1/tts/${job.jobId}/status`, undefined, TRANSIENT_RETRIES);
    const status = await statusResponse.json() as EdgeJobStatus;
    if (status.status === "failed") throw new Error(status.error ?? "Edge TTS gagal membuat audio.");
    if (status.status === "done") {
      const audioResponse = await authedFetch(token, `/v1/tts/${job.jobId}/audio`, undefined, TRANSIENT_RETRIES);
      return audioResponse.blob();
    }
  }

  throw new Error("Pembuatan satu bagian audio melewati batas 5 menit. Job aktif disimpan dan akan diperiksa kembali saat proses dilanjutkan.");
}

async function generateOneSegment(
  text: string,
  voice: string,
  bookId?: string,
  segmentIndex = 0,
  totalSegments = 1,
): Promise<SegmentResult> {
  const identity = await getSessionIdentity();
  const recoverable = bookId
    ? matchingRecoverableJob(identity.userId, bookId, segmentIndex, totalSegments, voice)
    : null;
  const jobId = recoverable?.jobId ?? await createJob(identity, text, voice, bookId, segmentIndex, totalSegments);

  try {
    const blob = await waitForJob(identity.token, { jobId, createdAt: recoverable?.createdAt ?? Date.now() });
    return { blob, jobId, userId: identity.userId, recovered: Boolean(recoverable) };
  } catch (error) {
    if (bookId && error instanceof Error && !error.message.includes("Job aktif disimpan")) {
      clearActiveEdgeJob(identity.userId, bookId, jobId);
    }
    throw error;
  }
}

export async function previewEdgeVoice(options: EdgeVoiceOptions) {
  const result = await generateOneSegment("Halo, ini contoh suara narator Apollonians Read.", options.voice);
  return result.blob;
}

export async function generateEdgeAudio(
  text: string,
  options: EdgeVoiceOptions,
  onProgress?: (progress: TtsProgress) => void,
  maximumChunks = Number.POSITIVE_INFINITY,
  bookId?: string,
  skipCount = 0,
  onChunkComplete?: (chunk: Blob) => Promise<unknown> | unknown,
  onRecovery?: (segmentIndex: number, totalSegments: number) => void,
) {
  const sourceChunks = textChunks(text);
  const selectedChunks = sourceChunks.slice(0, maximumChunks);
  const segments = mergeIntoSegments(selectedChunks.join(" "));
  const completedSegments = Math.min(Math.max(0, Math.floor(skipCount)), segments.length);
  const output: Blob[] = [];
  let recoveredJobs = 0;

  if (completedSegments > 0) {
    onProgress?.({ phase: "audio", completed: completedSegments, total: segments.length });
  }

  for (let index = completedSegments; index < segments.length; index += 1) {
    onProgress?.({ phase: "model", completed: index, total: segments.length });
    const result = await generateOneSegment(segments[index], options.voice, bookId, index, segments.length);
    if (result.recovered) {
      recoveredJobs += 1;
      onRecovery?.(index, segments.length);
    }
    output.push(result.blob);
    await onChunkComplete?.(result.blob);
    if (bookId) clearActiveEdgeJob(result.userId, bookId, result.jobId);
    onProgress?.({ phase: "audio", completed: index + 1, total: segments.length });
  }

  return {
    chunks: output,
    truncated: sourceChunks.length > selectedChunks.length,
    totalSegments: segments.length,
    resumedFrom: completedSegments,
    recoveredJobs,
  };
}
