export type LibriVoxReader = { id?: string; name: string };
export type LibriVoxSection = { id: string; number: number; title: string; audioUrl: string; duration: string; durationSeconds: number; readers: LibriVoxReader[] };
export type LibriVoxBook = {
  id: string; title: string; description: string; author: string; language: string; copyrightYear: string;
  totalTime: string; totalTimeSeconds: number; sectionCount: number; coverUrl: string; thumbnailUrl: string;
  textSourceUrl: string; librivoxUrl: string; archiveUrl: string; genres: string[]; sections: LibriVoxSection[];
};
export type LibriVoxSearchField = "title" | "author" | "genre";
type RawRecord = Record<string, unknown>;
type ApiPayload = { books?: RawRecord[] };
type RequestOptions = { signal?: AbortSignal; cacheTtlMs?: number };

const API_BASE = "https://librivox.org/api/feed/audiobooks";
const SEARCH_CACHE_TTL = 5 * 60 * 1000;
const DETAIL_CACHE_TTL = 30 * 60 * 1000;
const REQUEST_TIMEOUT = 8000;
const responseCache = new Map<string, { expiresAt: number; books: LibriVoxBook[] }>();
const detailRequests = new Map<string, Promise<LibriVoxBook>>();

const text = (value: unknown) => typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
const numeric = (value: unknown) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; };
const records = (value: unknown): RawRecord[] => Array.isArray(value) ? value.filter((item): item is RawRecord => Boolean(item) && typeof item === "object") : [];
const abortError = () => new DOMException("Permintaan dibatalkan.", "AbortError");

function stripMarkup(value: string) {
  if (!value) return "";
  if (typeof document === "undefined") return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const element = document.createElement("div");
  element.innerHTML = value;
  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}
function durationToSeconds(value: string) {
  const parts = value.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0);
}
function normalizeReader(raw: RawRecord): LibriVoxReader {
  const display = text(raw.display_name) || [text(raw.first_name), text(raw.last_name)].filter(Boolean).join(" ") || text(raw.name);
  return { id: text(raw.id) || undefined, name: display || "Pembaca LibriVox" };
}
function normalizeSection(raw: RawRecord, fallbackIndex: number): LibriVoxSection | null {
  const audioUrl = text(raw.listen_url) || text(raw.audio_url) || text(raw.url) || text(raw.mp3_url);
  if (!audioUrl) return null;
  const duration = text(raw.playtime) || text(raw.duration);
  const sectionNumber = numeric(raw.section_number) || numeric(raw.number) || fallbackIndex + 1;
  return {
    id: text(raw.id) || `${sectionNumber}-${audioUrl}`,
    number: sectionNumber,
    title: text(raw.title) || `Bagian ${sectionNumber}`,
    audioUrl,
    duration,
    durationSeconds: numeric(raw.playtime_secs) || numeric(raw.duration_seconds) || durationToSeconds(duration),
    readers: records(raw.readers).map(normalizeReader),
  };
}
export function normalizeLibriVoxBook(raw: RawRecord): LibriVoxBook {
  const author = records(raw.authors)
    .map((item) => [text(item.first_name), text(item.last_name)].filter(Boolean).join(" "))
    .filter(Boolean).join(", ") || "Penulis tidak diketahui";
  const sections = records(raw.sections).map(normalizeSection).filter((item): item is LibriVoxSection => Boolean(item)).sort((a, b) => a.number - b.number);
  return {
    id: text(raw.id), title: text(raw.title) || "Audiobook tanpa judul", description: stripMarkup(text(raw.description)), author,
    language: text(raw.language) || "Tidak diketahui", copyrightYear: text(raw.copyright_year), totalTime: text(raw.totaltime),
    totalTimeSeconds: numeric(raw.totaltimesecs), sectionCount: numeric(raw.num_sections) || sections.length,
    coverUrl: text(raw.coverart_jpg) || text(raw.coverart_thumbnail), thumbnailUrl: text(raw.coverart_thumbnail) || text(raw.coverart_jpg),
    textSourceUrl: text(raw.url_text_source), librivoxUrl: text(raw.url_librivox), archiveUrl: text(raw.url_iarchive),
    genres: records(raw.genres).map((genre) => text(genre.name) || text(genre.genre)).filter(Boolean), sections,
  };
}

function jsonp(params: URLSearchParams, signal?: AbortSignal): Promise<ApiPayload> {
  if (typeof document === "undefined") return Promise.reject(new Error("JSONP hanya tersedia di browser."));
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const callback = `__apollonians_librivox_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    let settled = false;
    const finish = (problem?: Error, payload?: ApiPayload) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      script.remove();
      delete (window as unknown as Record<string, unknown>)[callback];
      if (problem) reject(problem); else resolve(payload ?? {});
    };
    const onAbort = () => finish(abortError());
    const timeout = window.setTimeout(() => finish(new Error("Katalog LibriVox melewati batas waktu.")), REQUEST_TIMEOUT);
    (window as unknown as Record<string, unknown>)[callback] = (payload: ApiPayload) => finish(undefined, payload);
    signal?.addEventListener("abort", onAbort, { once: true });
    const jsonpParams = new URLSearchParams(params);
    jsonpParams.set("format", "jsonp");
    jsonpParams.set("callback", callback);
    script.src = `${API_BASE}/?${jsonpParams.toString()}`;
    script.async = true;
    script.onerror = () => finish(new Error("Katalog LibriVox tidak dapat dijangkau."));
    document.head.appendChild(script);
  });
}

async function fetchJson(params: URLSearchParams, signal?: AbortSignal): Promise<ApiPayload> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const fetchParams = new URLSearchParams(params);
    fetchParams.set("format", "json");
    const response = await fetch(`${API_BASE}/?${fetchParams.toString()}`, { cache: "force-cache", signal: controller.signal });
    if (!response.ok) throw new Error(`LibriVox merespons ${response.status}.`);
    return await response.json() as ApiPayload;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}

async function request(params: URLSearchParams, options: RequestOptions = {}) {
  params.set("coverart", "1");
  const cacheKey = params.toString();
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.books;
  if (options.signal?.aborted) throw abortError();

  let payload: ApiPayload;
  try {
    payload = typeof document === "undefined"
      ? await fetchJson(params, options.signal)
      : await jsonp(params, options.signal);
  } catch (problem) {
    if (options.signal?.aborted || (problem instanceof DOMException && problem.name === "AbortError")) throw abortError();
    payload = await fetchJson(params, options.signal);
  }

  const books = Array.isArray(payload.books) ? payload.books.map(normalizeLibriVoxBook) : [];
  responseCache.set(cacheKey, { expiresAt: Date.now() + (options.cacheTtlMs ?? SEARCH_CACHE_TTL), books });
  return books;
}

export async function searchLibriVoxBooks({ query = "", field = "title", limit = 8, offset = 0, signal }: { query?: string; field?: LibriVoxSearchField; limit?: number; offset?: number; signal?: AbortSignal }) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (query.trim()) params.set(field, query.trim());
  return request(params, { signal, cacheTtlMs: SEARCH_CACHE_TTL });
}

export function getLibriVoxBook(id: string, signal?: AbortSignal) {
  const existing = detailRequests.get(id);
  if (existing) return existing;
  const detailRequest = request(new URLSearchParams({ id, extended: "1" }), { signal, cacheTtlMs: DETAIL_CACHE_TTL })
    .then((books) => {
      if (!books[0]) throw new Error("Audiobook LibriVox tidak ditemukan.");
      return books[0];
    })
    .finally(() => detailRequests.delete(id));
  detailRequests.set(id, detailRequest);
  return detailRequest;
}

export function prefetchLibriVoxBook(id: string) {
  return getLibriVoxBook(id).catch(() => undefined);
}

export function librivoxStorageKey(userId: string, bookId: string) { return `apollonians-user-${userId}-librivox-saved-${bookId}`; }
export function isLibriVoxBookSaved(userId: string, bookId: string) { return typeof window !== "undefined" && localStorage.getItem(librivoxStorageKey(userId, bookId)) !== null; }
export function saveLibriVoxBook(userId: string, book: LibriVoxBook) { localStorage.setItem(librivoxStorageKey(userId, book.id), JSON.stringify({ ...book, savedAt: Date.now() })); }
export function removeSavedLibriVoxBook(userId: string, bookId: string) { localStorage.removeItem(librivoxStorageKey(userId, bookId)); }
