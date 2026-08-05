import type { Book } from "./content";

export function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function normalizeBookMetadata(book: Book, audioChunkCount?: number): Book {
  const progress = clampProgress(book.progress);
  const generated = audioChunkCount === undefined ? Boolean(book.generated) : audioChunkCount > 0;
  return {
    ...book,
    title: book.title.trim() || "Tanpa judul",
    author: book.author.trim() || "Penulis tidak diketahui",
    category: book.category.trim() || "Buku pribadi",
    duration: book.duration.trim() || "0m",
    progress,
    remaining: progress >= 100 ? "Selesai" : progress > 0 ? `${100 - progress}% tersisa` : "Belum dimulai",
    generated,
  };
}

export function mergeBookMetadata(local: Book, cloud: Book): Book {
  const localTime = Date.parse(local.updatedAt ?? local.createdAt ?? "") || 0;
  const cloudTime = Date.parse(cloud.updatedAt ?? cloud.createdAt ?? "") || 0;
  const newer = cloudTime > localTime ? cloud : local;

  return normalizeBookMetadata({
    ...local,
    ...newer,
    id: local.id,
    createdAt: local.createdAt ?? cloud.createdAt,
    updatedAt: newer.updatedAt ?? newer.createdAt,
    sourceName: newer.sourceName ?? local.sourceName ?? cloud.sourceName,
    localOnly: true,
    generated: Boolean(local.generated || cloud.generated),
    progress: Math.max(clampProgress(local.progress), clampProgress(cloud.progress)),
  });
}
