import { textChunks } from "./document-parser";

const VOICE_ID = "id_ID-news_tts-medium";
const VOICE_PATH = "id/id_ID/news_tts/medium/id_ID-news_tts-medium.onnx";
const LIBRARY_BASE = "https://huggingface.co/diffusionstudio/piper-voices/resolve/main";
const INDONESIAN_BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/main";

export type TtsProgress = {
  phase: "model" | "audio";
  completed: number;
  total: number;
};

async function withIndonesianModel<T>(task: () => Promise<T>) {
  const nativeFetch = window.fetch.bind(window);
  const concurrencyDescriptor = Object.getOwnPropertyDescriptor(navigator, "hardwareConcurrency");
  if (!window.crossOriginIsolated) {
    try {
      Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, value: 1 });
    } catch {
      // ONNX Runtime akan memilih fallback single-thread jika properti browser tidak dapat diubah.
    }
  }
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (requestUrl.startsWith(LIBRARY_BASE) && requestUrl.includes(VOICE_ID)) {
      return nativeFetch(requestUrl.replace(LIBRARY_BASE, INDONESIAN_BASE), init);
    }
    return nativeFetch(input, init);
  }) as typeof window.fetch;
  try {
    return await task();
  } finally {
    window.fetch = nativeFetch;
    if (!window.crossOriginIsolated) {
      try {
        if (concurrencyDescriptor) Object.defineProperty(navigator, "hardwareConcurrency", concurrencyDescriptor);
        else Reflect.deleteProperty(navigator, "hardwareConcurrency");
      } catch {
        // Tidak ada state aplikasi yang bergantung pada properti ini.
      }
    }
  }
}

export async function generateIndonesianAudio(
  text: string,
  onProgress?: (progress: TtsProgress) => void,
  maximumChunks = 24,
) {
  if (!navigator.storage?.getDirectory) {
    throw new Error("Browser ini belum mendukung penyimpanan model lokal. Gunakan Chrome atau Edge terbaru.");
  }

  const tts = await import("@mintplex-labs/piper-tts-web");
  tts.PATH_MAP[VOICE_ID] = VOICE_PATH;
  const allChunks = textChunks(text);
  const chunks = allChunks.slice(0, maximumChunks);
  const output: Blob[] = [];

  try {
    await withIndonesianModel(async () => {
      for (let index = 0; index < chunks.length; index += 1) {
        const blob = await tts.predict(
          { text: chunks[index], voiceId: VOICE_ID },
          ({ loaded, total }) => onProgress?.({ phase: "model", completed: loaded, total }),
        );
        output.push(blob);
        onProgress?.({ phase: "audio", completed: index + 1, total: chunks.length });
      }
    });
  } catch (error) {
    tts.TtsSession._instance = null;
    throw error;
  }

  return { chunks: output, truncated: allChunks.length > chunks.length };
}
