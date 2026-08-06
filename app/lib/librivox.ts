export type LibriVoxReader = { id?: string; name: string };
export type LibriVoxSection = { id: string; number: number; title: string; audioUrl: string; duration: string; durationSeconds: number; readers: LibriVoxReader[] };
export type LibriVoxBook = {
  id: string; title: string; description: string; author: string; language: string; copyrightYear: string;
  totalTime: string; totalTimeSeconds: number; sectionCount: number; coverUrl: string; thumbnailUrl: string;
  textSourceUrl: string; librivoxUrl: string; archiveUrl: string; genres: string[]; sections: LibriVoxSection[];
};
export type LibriVoxSearchField = "title" | "author" | "genre";
type RawRecord = Record<string, unknown>;
type SearchPayload = { response?: { docs?: RawRecord[] } };
type MetadataPayload = { metadata?: RawRecord; files?: RawRecord[] };

const ARCHIVE_SEARCH_BASE = "https://archive.org/advancedsearch.php";
const ARCHIVE_METADATA_BASE = "https://archive.org/metadata";
const ARCHIVE_DOWNLOAD_BASE = "https://archive.org/download";
const SEARCH_CACHE_TTL = 5 * 60 * 1000;
const DETAIL_CACHE_TTL = 30 * 60 * 1000;
const REQUEST_TIMEOUT = 18000;
export const LIBRIVOX_LIBRARY_EVENT = "apollonians:librivox-library";
const responseCache = new Map<string, { expiresAt: number; books: LibriVoxBook[] }>();
const detailRequests = new Map<string, Promise<LibriVoxBook>>();

const text = (value: unknown) => typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
const numeric = (value: unknown) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; };
const list = (value: unknown): string[] => Array.isArray(value) ? value.map(text).filter(Boolean) : text(value) ? [text(value)] : [];
const records = (value: unknown): RawRecord[] => Array.isArray(value) ? value.filter((item): item is RawRecord => Boolean(item) && typeof item === "object") : [];
const abortError = () => new DOMException("Permintaan dibatalkan.", "AbortError");

function stripMarkup(value: string) {
  if (!value) return "";
  if (typeof document === "undefined") return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const element = document.createElement("div");
  element.innerHTML = value;
  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}
function durationToSeconds(value: string) { const parts = value.split(":").map(Number); return parts.some((part) => !Number.isFinite(part)) ? 0 : parts.reduce((total, part) => total * 60 + part, 0); }
function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const hours = Math.floor(seconds / 3600); const minutes = Math.floor((seconds % 3600) / 60); const remaining = Math.round(seconds % 60);
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}` : `${minutes}:${String(remaining).padStart(2, "0")}`;
}
const archiveCover = (identifier: string) => identifier ? `https://archive.org/services/img/${encodeURIComponent(identifier)}` : "";

function normalizeSearchBook(raw: RawRecord): LibriVoxBook {
  const identifier = text(raw.identifier);
  return { id: identifier, title: text(raw.title) || "Audiobook tanpa judul", description: stripMarkup(text(raw.description)), author: list(raw.creator).join(", ") || "Penulis tidak diketahui", language: list(raw.language).join(", ") || "Tidak diketahui", copyrightYear: text(raw.date).slice(0, 4), totalTime: "", totalTimeSeconds: 0, sectionCount: 0, coverUrl: archiveCover(identifier), thumbnailUrl: archiveCover(identifier), textSourceUrl: "", librivoxUrl: "", archiveUrl: identifier ? `https://archive.org/details/${encodeURIComponent(identifier)}` : "", genres: list(raw.subject), sections: [] };
}
function audioFiles(files: RawRecord[]) {
  return files.filter((file) => { const name = text(file.name).toLowerCase(); const format = text(file.format).toLowerCase(); const source = text(file.source).toLowerCase(); return name.endsWith(".mp3") && !name.includes("_sample") && !name.includes("zip") && (format.includes("vbr mp3") || format.includes("64kbps mp3") || format.includes("128kbps mp3") || source === "original"); }).sort((a, b) => text(a.name).localeCompare(text(b.name), undefined, { numeric: true }));
}
function findMetadataUrl(metadata: RawRecord, pattern: RegExp) { const joined = [...list(metadata.identifier), ...list(metadata.source), ...list(metadata.external_identifier), ...list(metadata.description), ...list(metadata.notes)].join(" "); return joined.match(pattern)?.[0] ?? ""; }
function normalizeMetadataBook(identifier: string, payload: MetadataPayload): LibriVoxBook {
  const metadata = payload.metadata ?? {}; const files = audioFiles(records(payload.files)); const readerNames = list(metadata.contributor).filter((value) => /reader|librivox/i.test(value) || value.length > 1); const readers = readerNames.map((name) => ({ name }));
  const sections = files.map((file, index) => { const name = text(file.name); const title = text(file.title) || name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/^\d+\s*/, "").trim() || `Bagian ${index + 1}`; const duration = text(file.length) || text(file.duration); const durationSeconds = numeric(file.length) || numeric(file.duration) || durationToSeconds(duration); return { id: `${identifier}-${name}`, number: index + 1, title, audioUrl: `${ARCHIVE_DOWNLOAD_BASE}/${encodeURIComponent(identifier)}/${name.split("/").map(encodeURIComponent).join("/")}`, duration: duration || formatDuration(durationSeconds), durationSeconds, readers } satisfies LibriVoxSection; });
  const totalTimeSeconds = sections.reduce((total, section) => total + section.durationSeconds, 0);
  return { id: identifier, title: text(metadata.title) || "Audiobook tanpa judul", description: stripMarkup(text(metadata.description)), author: list(metadata.creator).join(", ") || "Penulis tidak diketahui", language: list(metadata.language).join(", ") || "Tidak diketahui", copyrightYear: text(metadata.date).slice(0, 4), totalTime: formatDuration(totalTimeSeconds), totalTimeSeconds, sectionCount: sections.length, coverUrl: archiveCover(identifier), thumbnailUrl: archiveCover(identifier), textSourceUrl: findMetadataUrl(metadata, /https?:\/\/(?:www\.)?(?:gutenberg\.org|archive\.org\/details)\/[^\s"<>]+/i), librivoxUrl: findMetadataUrl(metadata, /https?:\/\/(?:www\.)?librivox\.org\/[^\s"<>]+/i), archiveUrl: `https://archive.org/details/${encodeURIComponent(identifier)}`, genres: list(metadata.subject), sections };
}
async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController(); const onAbort = () => controller.abort(); signal?.addEventListener("abort", onAbort, { once: true }); const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try { const response = await fetch(url, { cache: "no-store", mode: "cors", credentials: "omit", referrerPolicy: "no-referrer", signal: controller.signal }); if (!response.ok) throw new Error(`Internet Archive merespons ${response.status}.`); return await response.json() as T; }
  catch (problem) { if (signal?.aborted) throw abortError(); if (problem instanceof DOMException && problem.name === "AbortError") throw new Error("Permintaan katalog melewati batas waktu."); throw problem; }
  finally { clearTimeout(timeout); signal?.removeEventListener("abort", onAbort); }
}
function escapeArchiveQuery(value: string) { return value.replace(/[+\-!(){}\[\]^"~*?:\\/]/g, "\\$&"); }
function buildArchiveQuery(query: string, field: LibriVoxSearchField) { const safe = escapeArchiveQuery(query.trim()); const fieldName = field === "author" ? "creator" : field === "genre" ? "subject" : "title"; return `collection:(librivoxaudio) AND mediatype:(audio) AND ${fieldName}:("${safe}")`; }

export async function searchLibriVoxBooks({ query = "", field = "title", limit = 8, offset = 0, signal }: { query?: string; field?: LibriVoxSearchField; limit?: number; offset?: number; signal?: AbortSignal }) {
  if (!query.trim()) return []; if (signal?.aborted) throw abortError(); const page = Math.floor(offset / limit) + 1;
  const params = new URLSearchParams({ q: buildArchiveQuery(query, field), rows: String(limit), page: String(page), output: "json", sort: "downloads desc" });
  for (const fieldName of ["identifier", "title", "creator", "description", "language", "subject", "date"]) params.append("fl[]", fieldName);
  const cacheKey = `search:${params.toString()}`; const cached = responseCache.get(cacheKey); if (cached && cached.expiresAt > Date.now()) return cached.books;
  const payload = await fetchJson<SearchPayload>(`${ARCHIVE_SEARCH_BASE}?${params.toString()}`, signal); const books = records(payload.response?.docs).map(normalizeSearchBook).filter((book) => book.id); responseCache.set(cacheKey, { expiresAt: Date.now() + SEARCH_CACHE_TTL, books }); return books;
}
export function getLibriVoxBook(id: string, signal?: AbortSignal) {
  const existing = detailRequests.get(id); if (existing) return existing; const cacheKey = `detail:${id}`; const cached = responseCache.get(cacheKey)?.books[0]; if (cached && (responseCache.get(cacheKey)?.expiresAt ?? 0) > Date.now()) return Promise.resolve(cached);
  const detailRequest = fetchJson<MetadataPayload>(`${ARCHIVE_METADATA_BASE}/${encodeURIComponent(id)}`, signal).then((payload) => { const book = normalizeMetadataBook(id, payload); if (!book.sections.length) throw new Error("Rekaman ini tidak memiliki file MP3 yang dapat diputar."); responseCache.set(cacheKey, { expiresAt: Date.now() + DETAIL_CACHE_TTL, books: [book] }); return book; }).finally(() => detailRequests.delete(id)); detailRequests.set(id, detailRequest); return detailRequest;
}
export function prefetchLibriVoxBook(id: string) { return getLibriVoxBook(id).catch(() => undefined); }

export function librivoxStorageKey(userId: string, bookId: string) { return `apollonians-user-${userId}-librivox-saved-${bookId}`; }
export function isLibriVoxBookSaved(userId: string, bookId: string) { return typeof window !== "undefined" && localStorage.getItem(librivoxStorageKey(userId, bookId)) !== null; }
export function listSavedLibriVoxBooks(userId: string): LibriVoxBook[] {
  if (typeof window === "undefined") return [];
  const prefix = `apollonians-user-${userId}-librivox-saved-`;
  return Object.keys(localStorage).filter((key) => key.startsWith(prefix)).flatMap((key) => { try { const value = JSON.parse(localStorage.getItem(key) ?? "null") as LibriVoxBook | null; return value?.id ? [value] : []; } catch { return []; } }).sort((a, b) => a.title.localeCompare(b.title));
}
function emitLibraryChange() { if (typeof window !== "undefined") window.dispatchEvent(new Event(LIBRIVOX_LIBRARY_EVENT)); }
export function saveLibriVoxBook(userId: string, book: LibriVoxBook) { localStorage.setItem(librivoxStorageKey(userId, book.id), JSON.stringify({ ...book, savedAt: Date.now() })); emitLibraryChange(); }
export function removeSavedLibriVoxBook(userId: string, bookId: string) { localStorage.removeItem(librivoxStorageKey(userId, bookId)); emitLibraryChange(); }
