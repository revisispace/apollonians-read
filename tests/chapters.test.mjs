import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("detects bare and titled chapter headings", async () => {
  const chapters = await readFile(new URL("app/lib/chapters.ts", projectRoot), "utf8");

  assert.match(chapters, /chapterPattern/);
  assert.match(chapters, /numberedHeadingPattern/);
  assert.match(chapters, /normalizeChapters/);
  assert.match(chapters, /chapterForProgress/);
  assert.match(chapters, /\{1,90\}\)\?\$\/i/);
  assert.match(chapters, /line\.length < 3/);
});

test("exposes editable account-scoped chapter markers", async () => {
  const [storage, manager, settings] = await Promise.all([
    readFile(new URL("app/lib/account-storage.ts", projectRoot), "utf8"),
    readFile(new URL("app/components/ChapterManagement.tsx", projectRoot), "utf8"),
    readFile(new URL("app/components/AccountSettingsView.tsx", projectRoot), "utf8"),
  ]);

  assert.match(storage, /chaptersKey\(userId: string, bookId: string\)/);
  assert.match(storage, /readCustomChapters/);
  assert.match(storage, /writeCustomChapters/);
  assert.match(storage, /clearCustomChapters/);
  assert.match(manager, /Tambah bab/);
  assert.match(manager, /Deteksi ulang/);
  assert.match(manager, /Simpan perubahan/);
  assert.match(manager, /removeChapter/);
  assert.match(settings, /<ChapterManagement userId=\{userId\}/);
});

test("exports audio parts using managed chapter names", async () => {
  const exporter = await readFile(new URL("app/lib/audio-export.ts", projectRoot), "utf8");

  assert.match(exporter, /readCustomChapters/);
  assert.match(exporter, /chapterForProgress/);
  assert.match(exporter, /chapterName/);
  assert.match(exporter, /chapters,/);
});
