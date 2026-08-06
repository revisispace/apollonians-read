export type AudiobookQueueEngine = "edge" | "piper";
export type AudiobookQueueStatus = "queued" | "running" | "done" | "error";

export type AudiobookQueueItem = {
  id: string;
  bookId: string;
  title: string;
  sourceName: string;
  engine: AudiobookQueueEngine;
  voice: string;
  quality: string;
  maximumChunks: number | null;
  status: AudiobookQueueStatus;
  progress: number;
  completedParts: number;
  totalParts: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
};

export type AudiobookQueueState = {
  paused: boolean;
  items: AudiobookQueueItem[];
};

export const AUDIOBOOK_QUEUE_EVENT = "apollonians-audiobook-queue";

const emptyState = (): AudiobookQueueState => ({ paused: false, items: [] });
const queueKey = (userId: string) => `apollonians-user-${userId}-audiobook-queue-v1`;

function normalizeItem(value: Partial<AudiobookQueueItem>): AudiobookQueueItem | null {
  if (!value.id || !value.bookId || !value.title || !value.sourceName) return null;
  return {
    id: value.id,
    bookId: value.bookId,
    title: value.title,
    sourceName: value.sourceName,
    engine: value.engine === "piper" ? "piper" : "edge",
    voice: value.voice || "Ryan",
    quality: value.quality || "Cuplikan cepat",
    maximumChunks: typeof value.maximumChunks === "number" && Number.isFinite(value.maximumChunks) ? value.maximumChunks : null,
    status: value.status === "done" || value.status === "error" ? value.status : "queued",
    progress: Math.max(0, Math.min(100, Number(value.progress) || 0)),
    completedParts: Math.max(0, Number(value.completedParts) || 0),
    totalParts: Math.max(0, Number(value.totalParts) || 0),
    error: typeof value.error === "string" ? value.error : undefined,
    createdAt: Number(value.createdAt) || Date.now(),
    updatedAt: Number(value.updatedAt) || Date.now(),
  };
}

export function readAudiobookQueue(userId: string): AudiobookQueueState {
  if (typeof window === "undefined" || !userId) return emptyState();
  try {
    const raw = localStorage.getItem(queueKey(userId));
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<AudiobookQueueState>;
    return {
      paused: Boolean(parsed.paused),
      items: Array.isArray(parsed.items) ? parsed.items.map(normalizeItem).filter((item): item is AudiobookQueueItem => Boolean(item)) : [],
    };
  } catch {
    return emptyState();
  }
}

export function writeAudiobookQueue(userId: string, state: AudiobookQueueState) {
  if (typeof window === "undefined" || !userId) return state;
  const normalized: AudiobookQueueState = {
    paused: Boolean(state.paused),
    items: state.items.map((item) => ({ ...item, status: item.status === "running" ? "queued" : item.status })),
  };
  try {
    localStorage.setItem(queueKey(userId), JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent(AUDIOBOOK_QUEUE_EVENT, { detail: { userId, state: normalized } }));
  } catch {
    // Queue continues in memory when local storage is unavailable.
  }
  return normalized;
}

export function enqueueAudiobook(userId: string, item: AudiobookQueueItem) {
  const current = readAudiobookQueue(userId);
  const deduplicated = current.items.filter((entry) => entry.bookId !== item.bookId || entry.status === "done");
  return writeAudiobookQueue(userId, { ...current, items: [...deduplicated, item] });
}
