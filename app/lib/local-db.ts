import { openDB, type DBSchema } from "idb";
import type { Book } from "./content";

export type LocalBookAsset = {
  id: string;
  book: Book;
  text: string;
  source?: Blob;
  audioChunks: Blob[];
  updatedAt: string;
};

interface ApolloniansDatabase extends DBSchema {
  books: {
    key: string;
    value: LocalBookAsset;
    indexes: { "by-updated": string };
  };
}

const DATABASE_NAME = "apollonians-read";

function database() {
  return openDB<ApolloniansDatabase>(DATABASE_NAME, 1, {
    upgrade(db) {
      const store = db.createObjectStore("books", { keyPath: "id" });
      store.createIndex("by-updated", "updatedAt");
    },
  });
}

export async function listLocalBooks() {
  if (typeof indexedDB === "undefined") return [];
  const db = await database();
  const records = await db.getAllFromIndex("books", "by-updated");
  return records.reverse();
}

export async function getLocalBook(id: string) {
  if (typeof indexedDB === "undefined") return undefined;
  return (await database()).get("books", id);
}

export async function saveLocalBook(asset: LocalBookAsset) {
  const db = await database();
  await db.put("books", asset);
}

export async function saveAudioChunks(id: string, audioChunks: Blob[]) {
  const db = await database();
  const asset = await db.get("books", id);
  if (!asset) throw new Error("Buku lokal tidak ditemukan.");
  asset.audioChunks = audioChunks;
  asset.book.generated = audioChunks.length > 0;
  asset.updatedAt = new Date().toISOString();
  await db.put("books", asset);
  return asset;
}

export async function removeLocalBook(id: string) {
  const db = await database();
  await db.delete("books", id);
}

export async function estimateLocalStorage() {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota };
}
