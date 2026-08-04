import { textChunks } from "./document-parser";
import { getSupabase } from "./supabase";
import type { TtsProgress } from "./piper";

const endpoint = process.env.NEXT_PUBLIC_QWEN_TTS_ENDPOINT?.trim().replace(/\/$/, "");

export const isQwenConfigured = Boolean(endpoint);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getSessionToken(): Promise<string> {
  const supabase = getSupabase();
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
  if (!data.session) throw new Error("Masuk ke akun untuk menggunakan worker Qwen.");
  return data.session.access_token;
}

async function authedFetch(token: string, path: string, init?: RequestInit): Promise<Response> {
  if (!endpoint) throw new Error("Worker Qwen belum dikonfigurasi oleh superadmin.");
  return fetch(`${endpoint}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  });
}

async function readError(response: Response): Promise<Error> {
  const problem = (await response.json().catch(() => null)) as { detail?: string } | null;
  return new Error(problem?.detail ?? `Worker Qwen gagal (${response.status}).`);
}

export async function generateQwenAudio(
  text: string,
  onProgress?: (progress: TtsProgress) => void,
  maximumChunks = 24,
  bookId?: string,
) {
  if (!endpoint) throw new Error("Worker Qwen belum dikonfigurasi oleh superadmin.");
  const token = await getSessionToken();
  const allChunks = textChunks(text);
  const chunks = allChunks.slice(0, maximumChunks);
  const output: Blob[] = [];

  for (let index = 0; index < chunks.length; index += 1) {
    onProgress?.({ phase: "model", completed: index, total: chunks.length });

    const start = await authedFetch(token, "/v1/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: chunks[index],
        book_id: bookId ?? null,
        language: "English",
        speaker: "Ryan",
      }),
    });
    if (!start.ok) throw await readError(start);
    const { job_id: jobId } = (await start.json()) as { job_id: string };

    for (;;) {
      await sleep(3000);
      const statusResponse = await authedFetch(token, `/v1/tts/${jobId}/status`);
      if (!statusResponse.ok) throw await readError(statusResponse);
      const body = (await statusResponse.json()) as { status: string; error?: string; model_loaded: boolean };
      if (body.status === "failed") throw new Error(body.error ?? "Worker Qwen gagal membuat audio.");
      if (body.status === "done") break;
    }

    const audioResponse = await authedFetch(token, `/v1/tts/${jobId}/audio`);
    if (!audioResponse.ok) throw await readError(audioResponse);
    output.push(await audioResponse.blob());
    onProgress?.({ phase: "audio", completed: index + 1, total: chunks.length });
  }

  return { chunks: output, truncated: allChunks.length > chunks.length };
}