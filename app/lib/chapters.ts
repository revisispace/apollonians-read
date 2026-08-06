export type DetectedChapter = {
  id: string;
  title: string;
  progress: number;
};

type ChapterDetectionContext = {
  userId: string;
  bookId: string;
};

let detectionContext: ChapterDetectionContext | null = null;

const chapterPattern = /^(?:bab|chapter|bagian|part)\s+(?:[ivxlcdm]+|\d+)(?:(?:\s*[:.\-–—]\s*|\s+).{1,90})?$/i;
const numberedHeadingPattern = /^\d+(?:\.\d+)*\s+.{2,90}$/;

function normalizeHeading(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function setChapterDetectionContext(userId: string, bookId: string) {
  detectionContext = { userId, bookId };
}

export function normalizeChapters(chapters: DetectedChapter[], maxChapters = 80) {
  return chapters
    .filter((chapter) => chapter.title.trim())
    .map((chapter, index) => ({
      id: chapter.id || `chapter-${index + 1}`,
      title: normalizeHeading(chapter.title).slice(0, 100),
      progress: Math.max(0, Math.min(1, Number.isFinite(chapter.progress) ? chapter.progress : 0)),
    }))
    .sort((left, right) => left.progress - right.progress)
    .filter((chapter, index, list) => index === 0 || Math.abs(chapter.progress - list[index - 1].progress) >= 0.001)
    .slice(0, maxChapters);
}

export function chaptersFromAudioChunks(chunkCount: number): DetectedChapter[] {
  const total = Math.max(0, Math.floor(chunkCount));
  if (!total) return [];
  return Array.from({ length: total }, (_, index) => ({
    id: `audio-chapter-${index + 1}`,
    title: `Bagian audio ${index + 1}`,
    progress: index / total,
  }));
}

function readManagedChapters(maxChapters: number) {
  if (typeof window === "undefined" || !detectionContext) return null;
  try {
    const key = `apollonians-user-${detectionContext.userId}-chapters-${detectionContext.bookId}`;
    const value = localStorage.getItem(key);
    return value ? normalizeChapters(JSON.parse(value) as DetectedChapter[], maxChapters) : null;
  } catch {
    return null;
  }
}

export function chapterForProgress(chapters: DetectedChapter[], progress: number) {
  if (!chapters.length) return null;
  const safeProgress = Math.max(0, Math.min(1, progress));
  return [...chapters].reverse().find((chapter) => chapter.progress <= safeProgress) ?? chapters[0];
}

export function detectChapters(text: string, maxChapters = 80, includeManaged = true): DetectedChapter[] {
  if (includeManaged) {
    const managed = readManagedChapters(maxChapters);
    if (managed) return managed;
  }

  const lines = text.split(/\r?\n/);
  const chapters: DetectedChapter[] = [];
  let cursor = 0;

  for (const rawLine of lines) {
    const line = normalizeHeading(rawLine);
    const lineStart = text.indexOf(rawLine, cursor);
    cursor = lineStart >= 0 ? lineStart + rawLine.length : cursor + rawLine.length;

    if (line.length < 3 || line.length > 100) continue;
    const isHeading = chapterPattern.test(line) || numberedHeadingPattern.test(line);
    if (!isHeading) continue;

    const progress = text.length ? Math.max(0, Math.min(1, (lineStart >= 0 ? lineStart : cursor) / text.length)) : 0;
    const previous = chapters.at(-1);
    if (previous?.title.toLowerCase() === line.toLowerCase()) continue;
    if (previous && Math.abs(previous.progress - progress) < 0.002) continue;

    chapters.push({
      id: `chapter-${chapters.length + 1}`,
      title: line,
      progress,
    });
    if (chapters.length >= maxChapters) break;
  }

  return normalizeChapters(chapters, maxChapters);
}
