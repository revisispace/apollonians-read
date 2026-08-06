import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("LibriVox requests use direct CORS first and JSONP fallback", async () => {
  const source = await readFile(new URL("app/lib/librivox.ts", root), "utf8");
  assert.match(source, /payload = await fetchJson\(params, options\.signal\)/);
  assert.match(source, /payload = await jsonp\(params, options\.signal\)/);
  assert.match(source, /jsonpParams\.set\("format", "json"\)/);
  assert.match(source, /jsonpParams\.set\("callback", callback\)/);
  assert.match(source, /REQUEST_TIMEOUT = 15000/);
  assert.match(source, /cache: "no-store"/);
  assert.match(source, /credentials: "omit"/);
});
