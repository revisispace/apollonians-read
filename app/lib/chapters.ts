export type DetectedChapter = {
  id: string;
  title: string;
  progress: number;
};

const chapterPattern = /^(?:bab|chapter|bagian|part)\s+(?:[ivxlcdm]+|\d+)(?:\s*[:.\-–—]\s*|\s+).{0,90}$/i;
const numberedHeadingPattern = /^\d+(?:\.\d+)*\s+.{2,90}$/;

function normalizeHeading(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function detectChapters(text: string, maxChapters = 80): DetectedChapter[] {
  const lines = text.split(/\r?\n/);
  const chapters: DetectedChapter[] = [];
  let cursor = 0;

  for (const rawLine of lines) {
    const line = normalizeHeading(rawLine);
    const lineStart = text.indexOf(rawLine, cursor);
    cursor = lineStart >= 0 ? lineStart + rawLine.length : cursor + rawLine.length;

    if (line.length < 4 || line.length > 100) continue;
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

  return chapters;
}
