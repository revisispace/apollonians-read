import { textChunks } from "./document-parser";
import { getSupabase } from "./supabase";
import type { TtsProgress } from "./piper";

const endpoint = process.env.NEXT_PUBLIC_QWEN_TTS_ENDPOINT?.trim().replace(/\/$/, "");

export const isQwenConfigured = Boolean(endpoint);

export async function generateQwenAudio(
  text: string,
  onProgress?: (progress: TtsProgress) => void,
  maximumChunks = 24,
  bookId?: string,
) {
  if (!endpoint) throw new Error("Worker Qwen belum dikonfigurasi oleh superadmin.");
  const supabase = getSupabase();
  const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
  if (!data.session) throw new Error("Masuk ke akun untuk menggunakan worker Qwen.");

  const allChunks = textChunks(text);
  const chunks = allChunks.slice(0, maximumChunks);
  const output: Blob[] = [];
  onProgress?.({ phase: "model", completed: 1, total: 1 });

  for (let index = 0; index < chunks.length; index += 1) {
    const response = await fetch(`${endpoint}/v1/tts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: chunks[index], book_id: bookId ?? null, language: "Auto", speaker: "Serena" }),
    });
    if (!response.ok) {
      const problem = await response.json().catch(() => null) as { detail?: string } | null;
      throw new Error(problem?.detail ?? `Worker Qwen gagal (${response.status}).`);
    }
    output.push(await response.blob());
    onProgress?.({ phase: "audio", completed: index + 1, total: chunks.length });
  }

  return { chunks: output, truncated: allChunks.length > chunks.length };
}
