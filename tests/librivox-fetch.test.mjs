import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("LibriVox requests use Internet Archive catalog and metadata endpoints", async () => {
  const source = await readFile(new URL("app/lib/librivox.ts", root), "utf8");
  assert.match(source, /https:\/\/archive\.org\/advancedsearch\.php/);
  assert.match(source, /https:\/\/archive\.org\/metadata/);
  assert.match(source, /collection:\(librivoxaudio\)/);
  assert.match(source, /mediatype:\(audio\)/);
  assert.match(source, /services\/img/);
  assert.match(source, /VBR MP3|64kbps mp3|128kbps mp3/);
  assert.match(source, /REQUEST_TIMEOUT = 18000/);
  assert.match(source, /cache: "no-store"/);
  assert.match(source, /credentials: "omit"/);
  assert.doesNotMatch(source, /librivox\.org\/api\/feed\/audiobooks/);
  assert.doesNotMatch(source, /function jsonp/);
});
