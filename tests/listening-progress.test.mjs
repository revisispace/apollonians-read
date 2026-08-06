import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("library status follows playback progress instead of audio availability", async () => {
  const [views, storage] = await Promise.all([
    readFile(new URL("app/components/Views.tsx", projectRoot), "utf8"),
    readFile(new URL("app/lib/account-storage.ts", projectRoot), "utf8"),
  ]);

  assert.match(views, /filter === "Selesai"\) return book\.progress >= 100/);
  assert.match(views, /filter === "Belum dimulai"\) return book\.progress === 0/);
  assert.doesNotMatch(views, /book\.progress === 100 \|\| book\.generated/);
  assert.match(views, /listLocalBooks\(\)/);
  assert.match(views, /readPlaybackPosition\(asset\.userId, asset\.id\)/);
  assert.match(views, /PLAYBACK_POSITION_EVENT/);
  assert.match(storage, /window\.dispatchEvent\(new CustomEvent\(PLAYBACK_POSITION_EVENT/);
});
