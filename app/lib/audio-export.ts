import JSZip from "jszip";
import type { Book } from "./content";
import { getLocalBook } from "./local-db";

function safeFilename(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "audiobook";
}

function extensionFor(blob: Blob) {
  if (/mpeg|mp3/i.test(blob.type)) return "mp3";
  if (/ogg/i.test(blob.type)) return "ogg";
  if (/wav/i.test(blob.type)) return "wav";
  if (/mp4|m4a|aac/i.test(blob.type)) return "m4a";
  return "webm";
}

export async function exportBookAudio(book: Book) {
  const asset = await getLocalBook(book.id);
  if (!asset?.audioChunks.length) throw new Error("Audio lokal belum tersedia untuk buku ini.");

  const zip = new JSZip();
  const folderName = safeFilename(book.title);
  const folder = zip.folder(folderName);
  if (!folder) throw new Error("Folder ekspor gagal dibuat.");

  const width = Math.max(2, String(asset.audioChunks.length).length);
  asset.audioChunks.forEach((chunk, index) => {
    const part = String(index + 1).padStart(width, "0");
    folder.file(`${part}-bagian-${index + 1}.${extensionFor(chunk)}`, chunk);
  });

  folder.file(
    "metadata.json",
    JSON.stringify(
      {
        title: book.title,
        author: book.author,
        parts: asset.audioChunks.length,
        exportedAt: new Date().toISOString(),
        sourceName: asset.book.sourceName ?? null,
      },
      null,
      2,
    ),
  );

  const archive = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(archive);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${folderName}-audio.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);

  return asset.audioChunks.length;
}
