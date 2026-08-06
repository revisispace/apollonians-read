import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("loads full-player styles after responsive and mobile player styles", async () => {
  const layout = await readFile(new URL("app/layout.tsx", projectRoot), "utf8");
  const responsiveIndex = layout.indexOf('import "./responsive.css"');
  const mobileIndex = layout.indexOf('import "./mobile-player.css"');
  const fullIndex = layout.indexOf('import "./full-player-v2.css"');

  assert.ok(responsiveIndex >= 0);
  assert.ok(mobileIndex > responsiveIndex);
  assert.ok(fullIndex > mobileIndex);
});

test("provides a responsive full player with structured chapter and bookmark panels", async () => {
  const [player, styles] = await Promise.all([
    readFile(new URL("app/components/EnhancedAccountAudioPlayer.tsx", projectRoot), "utf8"),
    readFile(new URL("app/full-player-v2.css", projectRoot), "utf8"),
  ]);

  assert.match(player, /full-player-v2/);
  assert.match(player, /role="dialog"/);
  assert.match(player, /Player penuh/);
  assert.match(player, /player-data-panel/);
  assert.match(player, /panel === "chapters"/);
  assert.match(player, /openPanel\("bookmarks"\)/);
  assert.match(player, /filteredBookmarks/);
  assert.match(player, /placeholder=\{`Cari/);
  assert.match(player, /moveChapter\(-1\)/);
  assert.match(player, /moveChapter\(1\)/);
  assert.match(player, /seek\(-15\)/);
  assert.match(player, /seek\(30\)/);
  assert.match(styles, /\.player-data-panel/);
  assert.match(styles, /position:fixed/);
  assert.match(styles, /height:100dvh/);
  assert.match(styles, /overflow:hidden/);
  assert.match(styles, /@media\(max-width:760px\)/);
  assert.match(styles, /env\(safe-area-inset-top\)/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
});

test("shows a proportional reading transcript for the active audio position", async () => {
  const player = await readFile(new URL("app/components/EnhancedAccountAudioPlayer.tsx", projectRoot), "utf8");

  assert.match(player, /reader-transcript-v2/);
  assert.match(player, /const activeText = textParts\[textIndex\]/);
  assert.match(player, /previousText/);
  assert.match(player, /nextText/);
  assert.match(player, /Perkiraan sinkronisasi berdasarkan bagian audio dan posisi waktu/);
  assert.match(player, /Math\.floor\(overall \* textParts\.length\)/);
});

test("does not open or advertise a usable full player without local audio", async () => {
  const player = await readFile(new URL("app/components/EnhancedAccountAudioPlayer.tsx", projectRoot), "utf8");

  assert.match(player, /const hasAudio = chunks > 0/);
  assert.match(player, /disabled=\{!hasAudio\}/);
  assert.match(player, /\{fullOpen && hasAudio &&/);
  assert.match(player, /Audio belum tersedia di perangkat ini/);
  assert.doesNotMatch(player, /chunks \|\| 1/);
});

test("playback state remains account-scoped and survives metadata-only parent updates", async () => {
  const player = await readFile(new URL("app/components/EnhancedAccountAudioPlayer.tsx", projectRoot), "utf8");

  assert.match(player, /readPlaybackPosition\(userId, book\.id\)/);
  assert.match(player, /writePlaybackPosition\(userId, book\.id/);
  assert.match(player, /audioRef\.current\.playbackRate = speed/);
  assert.match(player, /\}, \[book\.id, book\.localOnly, userId\]\);/);
  assert.doesNotMatch(player, /\}, \[book, speed, userId\]\);/);
  assert.doesNotMatch(player, /\}, \[book, userId\]\);/);
});
