import { textChunks } from "./document-parser";

export type DetectedChapter = {
  id: string;
  title: string;
  chunk: number;
};

const chapterPattern = /^(?:bab|chapter|bagian|part)\s+(?:[ivxlcdm]+|\d+)(?:\s*[:.\-–—]\s*|\s+).{0,90}$/i;
const numberedHeadingPattern = /^\d+(?:\.\d+)*\s+.{2,90}$/;

function normalizeHeading(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function detectChapters(text: string, maxChapters = 80): DetectedChapter[] {
  const chunks = textChunks(text);
  const lines = text.split(/\r?\n/).map(normalizeHeading).filter(Boolean);
  const chapters: DetectedChapter[] = [];
  let searchFrom = 0;

  for (const line of lines) {
    if (line.length < 4 || line.length > 100) continue;
    const isHeading = chapterPattern.test(line) || numberedHeadingPattern.test(line);
    if (!isHeading) continue;

    let chunkIndex = chunks.findIndex((chunk, index) => index >= searchFrom && chunk.includes(line));
    if (chunkIndex < 0) {
      const words = line.split(/\s+/).slice(0, 5).join(" ");
      chunkIndex = chunks.findIndex((chunk, index) => index >= searchFrom && chunk.includes(words));
    }
    if (chunkIndex < 0) continue;

    const previous = chapters.at(-1);
    if (previous?.chunk === chunkIndex || previous?.title.toLowerCase() === line.toLowerCase()) continue;

    chapters.push({
      id: `chapter-${chapters.length + 1}-${chunkIndex}`,
      title: line,
      chunk: chunkIndex,
    });
    searchFrom = chunkIndex;
    if (chapters.length >= maxChapters) break;
  }

  return chapters;
}
