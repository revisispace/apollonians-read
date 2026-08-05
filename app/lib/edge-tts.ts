import { textChunks } from "./document-parser";
import type { TtsProgress } from "./piper";
import { getSupabase } from "./supabase";

const configuredEndpoint = process.env.NEXT_PUBLIC_EDGE_TTS_ENDPOINT?.trim().replace(/\/$/, "");
export const edgeTtsEndpoint = configuredEndpoint || "https://apollonians.duckdns.org";
export const isEdgeTtsConfigured = Boolean(edgeTtsEndpoint);

const SEGMENT_LIMIT = 3500;
const POLL_INTERVAL_MS = 1200;

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
  status: "queued" | "processing" | "done" | "failed" | "cancelled";
  error?: string | null;
};

function sleep(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function mergeIntoSegments(text: string, limit = SEGMENT_LIMIT) {
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  const segments: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const piece = sentence.trim();
    if (!piece) continue;

    if (piece.length > limit) {
      if (current) {
        segments.push(current);
        current = "";
      }
      for (let offset = 0; offset < piece.length; offset += limit) {
        segments.push(piece.slice(offset, offset + limit));
      }
      continue;
    }

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

async function getSessionToken() {
  const supabase = getSupabase();
  const { data, error } = (await supabase?.auth.getSession()) ?? { data: { session: null }, error: null };
  if (error) throw error;
  if (!data.session) throw new Error("Masuk ke akun untuk menggunakan Edge TTS.");
  return data.session.access_token;
}

async function readError(response: Response) {
  const problem = (await response.json().catch(() => null)) as { detail?: string; error?: string } | null;
  return new Error(problem?.detail ?? problem?.error ?? `Layanan Edge TTS gagal (${response.status}).`);
}

async function authedFetch(path: string, init?: RequestInit) {
  const token = await getSessionToken();
  const response = await fetch(`${edgeTtsEndpoint}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) throw await readError(response);
  return response;
}

export async function getEdgeHealth() {
  const response = await fetch(`${edgeTtsEndpoint}/api/health`, { cache: "no-store" });
  if (!response.ok) throw await readError(response);
  return response.json() as Promise<{ ok: boolean; engine: string; queue_depth: number }>;
}

export async function listEdgeVoices() {
  const response = await authedFetch("/api/voices");
  const body = await response.json() as { voices: EdgeVoice[] };
  return body.voices;
}

export async function previewEdgeVoice(options: EdgeVoiceOptions) {
  const response = await authedFetch("/api/tts/preview", {
    method: "POST",
    body: JSON.stringify({
      text: "Halo, ini contoh suara narator Apollonians Read.",
      voice: options.voice,
      rate: options.rate ?? 0,
      pitch: options.pitch ?? 0,
      volume: options.volume ?? 0,
    }),
  });
  return response.blob();
}

export async function generateEdgeAudio(
  text: string,
  options: EdgeVoiceOptions,
  onProgress?: (progress: TtsProgress) => void,
  maximumChunks = Number.POSITIVE_INFINITY,
  bookId?: string,
  skipCount = 0,
  onChunkComplete?: (chunk: Blob) => Promise<void> | void,
) {
  const sourceChunks = textChunks(text);
  const selectedChunks = sourceChunks.slice(0, maximumChunks);
  const segments = mergeIntoSegments(selectedChunks.join(" "));
  const output: Blob[] = [];

  for (let index = 0; index < segments.length; index += 1) {
    if (index < skipCount) {
      onProgress?.({ phase: "audio", completed: index + 1, total: segments.length });
      continue;
    }

    onProgress?.({ phase: "model", completed: index, total: segments.length });
    const startResponse = await authedFetch("/api/tts/generate", {
      method: "POST",
      body: JSON.stringify({
        text: segments[index],
        book_id: bookId ?? null,
        voice: options.voice,
        rate: options.rate ?? 0,
        pitch: options.pitch ?? 0,
        volume: options.volume ?? 0,
      }),
    });
    const { job_id: jobId } = await startResponse.json() as { job_id: string };

    for (;;) {
      await sleep(POLL_INTERVAL_MS);
      const statusResponse = await authedFetch(`/api/jobs/${jobId}`);
      const status = await statusResponse.json() as EdgeJobStatus;
      if (status.status === "failed") throw new Error(status.error ?? "Edge TTS gagal membuat audio.");
      if (status.status === "cancelled") throw new Error("Pembuatan audio dibatalkan.");
      if (status.status === "done") break;
    }

    const audioResponse = await authedFetch(`/api/jobs/${jobId}/audio`);
    const blob = await audioResponse.blob();
    output.push(blob);
    await onChunkComplete?.(blob);
    onProgress?.({ phase: "audio", completed: index + 1, total: segments.length });
  }

  return {
    chunks: output,
    truncated: sourceChunks.length > selectedChunks.length,
    totalSegments: segments.length,
  };
}
