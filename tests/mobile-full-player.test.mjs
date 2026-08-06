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
  assert.match(player, /player-data-panel/);
  assert.match(player, /panel === "chapters"/);
  assert.match(player, /openPanel\("bookmarks"\)/);
  assert.match(player, /filteredBookmarks/);
  assert.match(player, /moveChapter\(-1\)/);
  assert.match(player, /moveChapter\(1\)/);
  assert.match(styles, /grid-template-rows:auto minmax\(0,1fr\) auto/);
  assert.match(styles, /\.full-player-v2-dock/);
  assert.match(styles, /position:fixed/);
  assert.match(styles, /height:100dvh/);
  assert.match(styles, /overflow:hidden/);
  assert.match(styles, /@media\(max-width:760px\)/);
});

test("reconstructs the same 3000-character Edge segments used by audio generation", async () => {
  const [player, mapping] = await Promise.all([
    readFile(new URL("app/components/EnhancedAccountAudioPlayer.tsx", projectRoot), "utf8"),
    readFile(new URL("app/lib/edge-audio-segments.ts", projectRoot), "utf8"),
  ]);
  assert.match(mapping, /EDGE_SEGMENT_LIMIT = 3000/);
  assert.match(mapping, /textChunks\(text\)\.slice\(0, maximumSourceChunks\)\.join\(" "\)/);
  assert.match(mapping, /if \(current && `\$\{current\} \$\{piece\}`\.length > EDGE_SEGMENT_LIMIT\)/);
  assert.match(player, /edgeAudioSegments\(asset\.text\)\.slice\(0, asset\.audioChunks\.length\)/);
  assert.match(player, /const currentAudioText = audioTexts\[chunk\]/);
  assert.match(player, /estimatedSentenceIndex\(currentSentences, partRatio\)/);
  assert.match(player, /Sorotan kalimat berdasarkan estimasi ritme, bukan timestamp TTS/);
  assert.doesNotMatch(player, /textChunks\(asset\.text\)/);
});

test("does not open a full player without local audio", async () => {
  const player = await readFile(new URL("app/components/EnhancedAccountAudioPlayer.tsx", projectRoot), "utf8");
  assert.match(player, /const hasAudio = chunks > 0/);
  assert.match(player, /disabled=\{!hasAudio\}/);
  assert.match(player, /\{fullOpen && hasAudio &&/);
  assert.match(player, /Audio belum tersedia di perangkat ini/);
});

test("playback state remains account-scoped and survives metadata-only parent updates", async () => {
  const player = await readFile(new URL("app/components/EnhancedAccountAudioPlayer.tsx", projectRoot), "utf8");
  assert.match(player, /readPlaybackPosition\(userId, book\.id\)/);
  assert.match(player, /writePlaybackPosition\(userId, book\.id/);
  assert.match(player, /speedRef\.current = speed/);
  assert.match(player, /\}, \[book\.id, book\.localOnly, userId\]\);/);
  assert.doesNotMatch(player, /\}, \[book, speed, userId\]\);/);
});
