import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("LibriVox search clears stale results and caches requests", async () => {
  const view = await readFile(new URL("app/components/LibriVoxView.tsx", projectRoot), "utf8");
  const client = await readFile(new URL("app/lib/librivox.ts", projectRoot), "utf8");
  assert.match(view, /searchControllerRef\.current\?\.abort\(\)/);
  assert.match(view, /setBooks\(\[\]\)/);
  assert.match(view, /clearStaleResults/);
  assert.match(client, /responseCache/);
  assert.match(client, /SEARCH_CACHE_TTL/);
  assert.match(client, /prefetchLibriVoxBook/);
  assert.match(client, /signal\?: AbortSignal/);
});

test("LibriVox cards expose playback and player reports loading", async () => {
  const view = await readFile(new URL("app/components/LibriVoxView.tsx", projectRoot), "utf8");
  const css = await readFile(new URL("app/librivox.css", projectRoot), "utf8");
  assert.match(view, /Putar audiobook/);
  assert.match(view, /openBook\(book, true\)/);
  assert.match(view, /preload="auto"/);
  assert.match(view, /onWaiting/);
  assert.match(view, /onCanPlay/);
  assert.match(view, /librivox-player-status/);
  assert.match(view, /Buka teks sumber/);
  assert.match(view, /tidak menyediakan subtitle atau timestamp sinkron/);
  assert.match(css, /\.librivox-card-actions \.play/);
  assert.match(css, /\.librivox-source-panel/);
});

test("mobile navigation uses a compact more menu", async () => {
  const navigation = await readFile(new URL("app/components/Navigation.tsx", projectRoot), "utf8");
  const css = await readFile(new URL("app/mobile-menu.css", projectRoot), "utf8");
  const layout = await readFile(new URL("app/layout.tsx", projectRoot), "utf8");
  assert.match(navigation, /MOBILE_PRIMARY_ITEMS/);
  assert.match(navigation, /Lainnya/);
  assert.match(navigation, /mobile-more-sheet/);
  assert.match(navigation, /Profil, logout, dan data perangkat/);
  assert.match(css, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(css, /mobile-more-backdrop/);
  assert.match(layout, /mobile-menu\.css/);
});
