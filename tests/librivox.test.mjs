import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("adds LibriVox to application navigation and routing", async () => {
  const [navigation, app, header] = await Promise.all([
    readFile(new URL("app/components/Navigation.tsx", root), "utf8"),
    readFile(new URL("app/components/AudiobookApp.tsx", root), "utf8"),
    readFile(new URL("app/components/AppHeader.tsx", root), "utf8"),
  ]);
  assert.match(navigation, /"librivox"/);
  assert.match(navigation, /label: "LibriVox"/);
  assert.match(app, /<UnifiedLibriVoxEntry userId=\{userId\}/);
  assert.match(app, /active!=="librivox"&&selectedBook/);
  assert.match(header, /librivox: "LibriVox"/);
});

test("uses Internet Archive as the browser-safe LibriVox catalog source", async () => {
  const client = await readFile(new URL("app/lib/librivox.ts", root), "utf8");
  assert.match(client, /archive\.org\/advancedsearch\.php/);
  assert.match(client, /archive\.org\/metadata/);
  assert.match(client, /archive\.org\/download/);
  assert.match(client, /collection:\(librivoxaudio\)/);
  assert.match(client, /identifier/);
  assert.match(client, /creator/);
  assert.match(client, /subject/);
  assert.match(client, /audioUrl/);
});

test("provides streaming chapters, progress, bookmarks, and honest subtitle limitations", async () => {
  const view = await readFile(new URL("app/components/LibriVoxView.tsx", root), "utf8");
  assert.match(view, /activeSection\.audioUrl/);
  assert.match(view, /readPlaybackPosition/);
  assert.match(view, /writePlaybackPosition/);
  assert.match(view, /readAudioBookmarks/);
  assert.match(view, /writeAudioBookmarks/);
  assert.match(view, /Daftar bagian/);
  assert.match(view, /tidak menyediakan subtitle atau timestamp/);
  assert.match(view, /Buka teks sumber/);
});

test("loads responsive LibriVox styles", async () => {
  const [layout, styles] = await Promise.all([
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/librivox.css", root), "utf8"),
  ]);
  assert.match(layout, /import "\.\/librivox\.css"/);
  assert.match(styles, /\.librivox-grid/);
  assert.match(styles, /\.librivox-detail-grid/);
  assert.match(styles, /@media\(max-width:760px\)/);
});
