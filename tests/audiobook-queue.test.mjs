import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("persists an account-scoped audiobook generation queue", async () => {
  const queue = await readFile(new URL("app/lib/audiobook-queue.ts", root), "utf8");
  assert.match(queue, /apollonians-user-\$\{userId\}-audiobook-queue-v1/);
  assert.match(queue, /status: item\.status === "running" \? "queued"/);
  assert.match(queue, /enqueueAudiobook/);
  assert.match(queue, /paused: boolean/);
});

test("studio enqueues books and processes one item at a time", async () => {
  const [studio, app] = await Promise.all([
    readFile(new URL("app/components/EdgeStudioView.tsx", root), "utf8"),
    readFile(new URL("app/components/AudiobookApp.tsx", root), "utf8"),
  ]);
  assert.match(studio, /processingRef\.current/);
  assert.match(studio, /queue\.items\.find\(\(item\) => item\.status === "queued"\)/);
  assert.match(studio, /Tambahkan ke antrean/);
  assert.match(studio, /Jeda antrean/);
  assert.match(studio, /Coba lagi/);
  assert.match(studio, /appendAudioChunk\(nextItem\.bookId, chunk\)/);
  assert.match(app, /<EdgeStudioView onCreated=\{createdBook\} userId=\{userId\}/);
});

test("loads responsive audiobook queue styles", async () => {
  const [layout, css] = await Promise.all([
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/audiobook-queue.css", root), "utf8"),
  ]);
  assert.match(layout, /audiobook-queue\.css/);
  assert.match(css, /\.queue-card/);
  assert.match(css, /@media\(max-width:760px\)/);
});
