import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("loads the dedicated mobile player stylesheet after responsive overrides", async () => {
  const layout = await readFile(new URL("app/layout.tsx", projectRoot), "utf8");
  const responsiveIndex = layout.indexOf('import "./responsive.css"');
  const playerIndex = layout.indexOf('import "./mobile-player.css"');

  assert.ok(responsiveIndex >= 0);
  assert.ok(playerIndex > responsiveIndex);
});

test("provides a full-screen mobile player with chapter and bookmark panels", async () => {
  const [player, styles] = await Promise.all([
    readFile(new URL("app/components/AccountAudioPlayer.tsx", projectRoot), "utf8"),
    readFile(new URL("app/mobile-player.css", projectRoot), "utf8"),
  ]);

  assert.match(player, /mobile-full-player/);
  assert.match(player, /role="dialog"/);
  assert.match(player, /Player penuh/);
  assert.match(player, /mobilePanel === "chapters"/);
  assert.match(player, /mobilePanel === "bookmarks"/);
  assert.match(player, /moveChapter\(-1\)/);
  assert.match(player, /moveChapter\(1\)/);
  assert.match(player, /seek\(-15\)/);
  assert.match(player, /seek\(30\)/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /position: fixed;\s*\n\s*inset: 0;/);
  assert.match(styles, /env\(safe-area-inset-top\)/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
});

test("integrates lock-screen controls through the Media Session API", async () => {
  const player = await readFile(new URL("app/components/AccountAudioPlayer.tsx", projectRoot), "utf8");

  assert.match(player, /navigator\.mediaSession\.metadata = new MediaMetadata/);
  assert.match(player, /setActionHandler\("play"/);
  assert.match(player, /setActionHandler\("pause"/);
  assert.match(player, /setActionHandler\("seekbackward"/);
  assert.match(player, /setActionHandler\("seekforward"/);
  assert.match(player, /setActionHandler\("previoustrack"/);
  assert.match(player, /setActionHandler\("nexttrack"/);
  assert.match(player, /setPositionState/);
});

test("changing playback speed does not reload the selected book", async () => {
  const player = await readFile(new URL("app/components/AccountAudioPlayer.tsx", projectRoot), "utf8");

  assert.match(player, /useEffect\(\(\) => \{\s*\n\s*if \(audioRef\.current\) audioRef\.current\.playbackRate = speed;/);
  assert.doesNotMatch(player, /\}, \[book, speed, userId\]\);/);
  assert.match(player, /\}, \[book, userId\]\);/);
});
