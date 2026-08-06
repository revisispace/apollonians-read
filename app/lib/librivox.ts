export type LibriVoxAuthor = {
  id?: string;
  firstName: string;
  lastName: string;
};

export type LibriVoxReader = {
  id?: string;
  name: string;
};

export type LibriVoxSection = {
  id: string;
  number: number;
  title: string;
  audioUrl: string;
  duration: string;
  durationSeconds: number;
  readers: LibriVoxReader[];
};

export type LibriVoxBook = {
  id: string;
  title: string;
  description: string;
  author: string;
  language: string;
  copyrightYear: string;
  totalTime: string;
  totalTimeSeconds: number;
  sectionCount: number;
  coverUrl: string;
  thumbnailUrl: string;
  textSourceUrl: string;
  librivoxUrl: string;
  archiveUrl: string;
  genres: string[];
  sections: LibriVoxSection[];
};

export type LibriVoxSearchField = "title" | "author" | "genre";

type RawRecord = Record<string, unknown>;

const API_BASE = "https://librivox.org/api/feed/audiobooks";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function records(value: unknown): RawRecord[] {
  return Array.isArray(value) ? value.filter((item): item is RawRecord => Boolean(item) && typeof item === "object") : [];
}

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
  const authors = records(raw.authors).map((author) => ({
    id: text(author.id) || undefined,
    firstName: text(author.first_name),
    lastName: text(author.last_name),
  }));
  const author = authors.map((item) => [item.firstName, item.lastName].filter(Boolean).join(" ")).filter(Boolean).join(", ") || "Penulis tidak diketahui";
  const sections = records(raw.sections)
    .map(normalizeSection)
    .filter((section): section is LibriVoxSection => Boolean(section))
    .sort((a, b) => a.number - b.number);
  const genres = records(raw.genres).map((genre) => text(genre.name) || text(genre.genre)).filter(Boolean);
  return {
    id: text(raw.id),
    title: text(raw.title) || "Audiobook tanpa judul",
    description: stripMarkup(text(raw.description)),
    author,
    language: text(raw.language) || "Tidak diketahui",
    copyrightYear: text(raw.copyright_year),
    totalTime: text(raw.totaltime),
    totalTimeSeconds: numeric(raw.totaltimesecs),
    sectionCount: numeric(raw.num_sections) || sections.length,
    coverUrl: text(raw.coverart_jpg) || text(raw.coverart_thumbnail),
    thumbnailUrl: text(raw.coverart_thumbnail) || text(raw.coverart_jpg),
    textSourceUrl: text(raw.url_text_source),
    librivoxUrl: text(raw.url_librivox),
    archiveUrl: text(raw.url_iarchive),
    genres,
    sections,
  };
}

async function request(params: URLSearchParams) {
  params.set("format", "json");
  params.set("coverart", "1");
  const response = await fetch(`${API_BASE}/?${params.toString()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Katalog LibriVox tidak dapat dimuat (${response.status}).`);
  const payload = await response.json() as { books?: RawRecord[] };
  return Array.isArray(payload.books) ? payload.books.map(normalizeLibriVoxBook) : [];
}

export async function searchLibriVoxBooks({
  query = "",
  field = "title",
  limit = 18,
  offset = 0,
}: {
  query?: string;
  field?: LibriVoxSearchField;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (query.trim()) params.set(field, query.trim());
  return request(params);
}

export async function getLibriVoxBook(id: string) {
  const params = new URLSearchParams({ id, extended: "1" });
  const books = await request(params);
  if (!books[0]) throw new Error("Audiobook LibriVox tidak ditemukan.");
  return books[0];
}

export function librivoxStorageKey(userId: string, bookId: string) {
  return `apollonians-user-${userId}-librivox-saved-${bookId}`;
}

export function isLibriVoxBookSaved(userId: string, bookId: string) {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(librivoxStorageKey(userId, bookId)) !== null;
}

export function saveLibriVoxBook(userId: string, book: LibriVoxBook) {
  localStorage.setItem(librivoxStorageKey(userId, book.id), JSON.stringify({ ...book, savedAt: Date.now() }));
}

export function removeSavedLibriVoxBook(userId: string, bookId: string) {
  localStorage.removeItem(librivoxStorageKey(userId, bookId));
}
