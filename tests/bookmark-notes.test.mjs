import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("stores backward-compatible bookmark chapter notes", async () => {
  const storage = await readFile(new URL("app/lib/account-storage.ts", root), "utf8");
  assert.match(storage, /chapterId\?: string/);
  assert.match(storage, /chapterTitle\?: string/);
  assert.match(storage, /note\?: string/);
  assert.match(storage, /normalizeBookmark/);
  assert.match(storage, /slice\(0, 1000\)/);
});

test("groups bookmarks by managed chapter and edits notes", async () => {
  const player = await readFile(new URL("app/components/EnhancedAccountAudioPlayer.tsx", root), "utf8");
  assert.match(player, /bookmarkGroups/);
  assert.match(player, /chapterTitle = activeChapter\?\.title/);
  assert.match(player, /saveBookmarkNote/);
  assert.match(player, /Bookmark dan catatan/);
  assert.match(player, /Tambah catatan/);
});

test("loads responsive bookmark note styles", async () => {
  const [layout, styles] = await Promise.all([
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/bookmark-notes.css", root), "utf8"),
  ]);
  assert.match(layout, /import "\.\/bookmark-notes\.css"/);
  assert.match(styles, /\.bookmark-group/);
  assert.match(styles, /\.bookmark-note-editor/);
  assert.match(styles, /@media\(max-width:760px\)/);
});
