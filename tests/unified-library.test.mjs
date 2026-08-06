import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("combines personal and saved LibriVox books in one library", async () => {
  const [views, app, client] = await Promise.all([
    readFile(new URL("app/components/Views.tsx", root), "utf8"),
    readFile(new URL("app/components/AudiobookApp.tsx", root), "utf8"),
    readFile(new URL("app/lib/librivox.ts", root), "utf8"),
  ]);
  assert.match(views, /KOLEKSI TERPADU/);
  assert.match(views, /savedLibriVox/);
  assert.match(views, /Semua sumber/);
  assert.match(views, /LIBRIVOX · STREAMING/);
  assert.match(app, /listSavedLibriVoxBooks/);
  assert.match(app, /onOpenLibriVox/);
  assert.match(client, /LIBRIVOX_LIBRARY_EVENT/);
  assert.match(client, /listSavedLibriVoxBooks/);
});

test("launches a saved LibriVox book with local progress", async () => {
  const launcher = await readFile(new URL("app/components/UnifiedLibriVoxEntry.tsx", root), "utf8");
  assert.match(launcher, /apollonians:librivox-open/);
  assert.match(launcher, /getLibriVoxBook/);
  assert.match(launcher, /readPlaybackPosition/);
  assert.match(launcher, /writePlaybackPosition/);
  assert.match(launcher, /Daftar bagian/);
});

test("loads responsive unified library styles", async () => {
  const [layout, styles] = await Promise.all([
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/unified-library.css", root), "utf8"),
  ]);
  assert.match(layout, /unified-library\.css/);
  assert.match(styles, /\.librivox-library-cover/);
  assert.match(styles, /@media\(max-width:760px\)/);
});
