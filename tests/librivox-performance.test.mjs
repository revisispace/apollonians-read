import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("LibriVox catalog is search-first and page-limited", async () => {
  const view = await readFile(new URL("app/components/LibriVoxView.tsx", projectRoot), "utf8");
  assert.match(view, /const PAGE_SIZE = 8/);
  assert.match(view, /const MIN_QUERY_LENGTH = 3/);
  assert.match(view, /const \[submittedQuery, setSubmittedQuery\]/);
  assert.match(view, /if \(!submittedQuery\) return/);
  assert.match(view, /limit: PAGE_SIZE/);
  assert.match(view, /requestIdRef/);
  assert.match(view, /loading="lazy"/);
  assert.match(view, /Katalog baru dihubungi setelah kamu menekan Cari atau Enter/);
  assert.doesNotMatch(view, /useState\(true\)/);
});
