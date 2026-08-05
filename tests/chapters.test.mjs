import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("detects chapter headings and exposes chapter navigation", async () => {
  const [chapters, player] = await Promise.all([
    readFile(new URL("app/lib/chapters.ts", projectRoot), "utf8"),
    readFile(new URL("app/components/AccountAudioPlayer.tsx", projectRoot), "utf8"),
  ]);

  assert.match(chapters, /chapterPattern/);
  assert.match(chapters, /numberedHeadingPattern/);
  assert.match(chapters, /progress/);
  assert.match(player, /detectChapters\(asset\.text\)/);
  assert.match(player, /Daftar bab/);
  assert.match(player, /Bab tidak terdeteksi/);
  assert.match(player, /jumpToChapter/);
  assert.match(player, /Math\.floor\(chapter\.progress \* chunks\)/);
});
