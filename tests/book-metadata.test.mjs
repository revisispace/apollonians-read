import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("normalizes and reconciles book metadata deterministically", async () => {
  const helper = await readFile(new URL("app/lib/book-metadata.ts", root), "utf8");
  assert.match(helper, /clampProgress/);
  assert.match(helper, /Math\.max\(clampProgress\(local\.progress\), clampProgress\(cloud\.progress\)\)/);
  assert.match(helper, /audioChunkCount > 0/);
  assert.match(helper, /cloudTime > localTime/);
});

test("library load merges local and cloud copies then syncs reconciled local metadata", async () => {
  const app = await readFile(new URL("app/components/AudiobookApp.tsx", root), "utf8");
  assert.match(app, /mergeBookMetadata/);
  assert.match(app, /new Map\(cloudBooks\.map/);
  assert.match(app, /Promise\.allSettled\(mergedLocal\.map\(\(book\) => syncBookMetadata\(book\)\)\)/);
});

test("cloud mapping preserves updated timestamps", async () => {
  const cloud = await readFile(new URL("app/lib/cloud-library.ts", root), "utf8");
  assert.match(cloud, /updated_at\?: string \| null/);
  assert.match(cloud, /updatedAt: row\.updated_at \?\? row\.created_at/);
  assert.match(cloud, /order\("updated_at"/);
});
