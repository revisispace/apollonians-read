import { openDB, type DBSchema } from "idb";
import type { Book } from "./content";
import { getSupabase } from "./supabase";

export type LocalBookAsset = {
  id: string;
  book: Book;
  text: string;
  source?: Blob;
  audioChunks: Blob[];
  updatedAt: string;
};

export type AccountLocalBookAsset = LocalBookAsset & {
  storageKey: string;
  userId: string;
};

interface ApolloniansDatabase extends DBSchema {
  books: {
    key: string;
    value: LocalBookAsset;
    indexes: { "by-updated": string };
  };
  accountBooks: {
    key: string;
    value: AccountLocalBookAsset;
    indexes: {
      "by-user": string;
      "by-user-updated": [string, string];
    };
  };
}

const DATABASE_NAME = "apollonians-read";
const DATABASE_VERSION = 2;

function scopedBookKey(userId: string, bookId: string) {
  return `${userId}:${bookId}`;
}

async function requireAuthenticatedUserId() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Layanan autentikasi belum dikonfigurasi.");

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.user.id) throw new Error("Sesi akun tidak ditemukan. Silakan masuk kembali.");

  return data.session.user.id;
}

function database() {
  return openDB<ApolloniansDatabase>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("books")) {
        const legacyStore = db.createObjectStore("books", { keyPath: "id" });
        legacyStore.createIndex("by-updated", "updatedAt");
      }

      if (!db.objectStoreNames.contains("accountBooks")) {
        const accountStore = db.createObjectStore("accountBooks", { keyPath: "storageKey" });
        accountStore.createIndex("by-user", "userId");
        accountStore.createIndex("by-user-updated", ["userId", "updatedAt"]);
      }
    },
  });
}

function toAccountAsset(userId: string, asset: LocalBookAsset | AccountLocalBookAsset): AccountLocalBookAsset {
  return {
    storageKey: scopedBookKey(userId, asset.id),
    userId,
    id: asset.id,
    book: asset.book,
    text: asset.text,
    source: asset.source,
    audioChunks: asset.audioChunks,
    updatedAt: asset.updatedAt,
  };
}

export async function hasLegacyLocalBooks() {
  if (typeof indexedDB === "undefined") return false;
  const db = await database();
  return (await db.count("books")) > 0;
}

export async function claimLegacyLocalBooks() {
  if (typeof indexedDB === "undefined") return 0;

  const userId = await requireAuthenticatedUserId();
  const db = await database();
  const legacyAssets = await db.getAll("books");
  if (!legacyAssets.length) return 0;

  const transaction = db.transaction(["books", "accountBooks"], "readwrite");
  for (const asset of legacyAssets) {
    await transaction.objectStore("accountBooks").put(toAccountAsset(userId, asset));
  }
  await transaction.objectStore("books").clear();
  await transaction.done;

  return legacyAssets.length;
}

export async function listLocalBooks() {
  if (typeof indexedDB === "undefined") return [];

  const userId = await requireAuthenticatedUserId();
  const db = await database();
  const records = await db.getAllFromIndex("accountBooks", "by-user", userId);
  return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getLocalBook(id: string) {
  if (typeof indexedDB === "undefined") return undefined;

  const userId = await requireAuthenticatedUserId();
  const asset = await (await database()).get("accountBooks", scopedBookKey(userId, id));
  return asset?.userId === userId ? asset : undefined;
}

export async function saveLocalBook(asset: LocalBookAsset | AccountLocalBookAsset) {
  const userId = await requireAuthenticatedUserId();
  const storedAsset = toAccountAsset(userId, asset);
  const db = await database();
  await db.put("accountBooks", storedAsset);
  return storedAsset;
}

export async function saveAudioChunks(id: string, audioChunks: Blob[]) {
  const userId = await requireAuthenticatedUserId();
  const db = await database();
  const key = scopedBookKey(userId, id);
  const asset = await db.get("accountBooks", key);
  if (!asset || asset.userId !== userId) throw new Error("Buku lokal tidak ditemukan untuk akun ini.");

  const updated: AccountLocalBookAsset = {
    ...asset,
    audioChunks,
    book: { ...asset.book, generated: audioChunks.length > 0 },
    updatedAt: new Date().toISOString(),
  };
  await db.put("accountBooks", updated);
  return updated;
}

export async function appendAudioChunk(id: string, chunk: Blob) {
  const userId = await requireAuthenticatedUserId();
  const db = await database();
  const key = scopedBookKey(userId, id);
  const asset = await db.get("accountBooks", key);
  if (!asset || asset.userId !== userId) throw new Error("Buku lokal tidak ditemukan untuk akun ini.");

  const updated: AccountLocalBookAsset = {
    ...asset,
    audioChunks: [...asset.audioChunks, chunk],
    book: { ...asset.book, generated: true },
    updatedAt: new Date().toISOString(),
  };
  await db.put("accountBooks", updated);
  return updated;
}

export async function updateLocalBookTitle(id: string, title: string) {
  const userId = await requireAuthenticatedUserId();
  const db = await database();
  const key = scopedBookKey(userId, id);
  const asset = await db.get("accountBooks", key);
  if (!asset || asset.userId !== userId) return undefined;

  const updated: AccountLocalBookAsset = {
    ...asset,
    book: { ...asset.book, title },
    updatedAt: new Date().toISOString(),
  };
  await db.put("accountBooks", updated);
  return updated.book;
}

export async function removeLocalBook(id: string) {
  const userId = await requireAuthenticatedUserId();
  const db = await database();
  await db.delete("accountBooks", scopedBookKey(userId, id));
}

export async function clearCurrentUserLocalBooks() {
  if (typeof indexedDB === "undefined") return;

  const userId = await requireAuthenticatedUserId();
  const db = await database();
  const transaction = db.transaction("accountBooks", "readwrite");
  const index = transaction.store.index("by-user");
  let cursor = await index.openCursor(userId);

  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }

  await transaction.done;
}

export async function estimateLocalStorage() {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota };
}
