import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const storage = await readFile(new URL("../app/lib/account-storage.ts", import.meta.url), "utf8");
const edge = await readFile(new URL("../app/lib/edge-tts.ts", import.meta.url), "utf8");
const app = await readFile(new URL("../app/components/AudiobookApp.tsx", import.meta.url), "utf8");

test("persists active Edge jobs per account and book", () => {
  assert.match(storage, /export type ActiveEdgeJob/);
  assert.match(storage, /activeEdgeJobKey\(userId, bookId\)/);
  assert.match(storage, /writeActiveEdgeJob/);
  assert.match(storage, /listActiveEdgeJobs/);
  assert.match(storage, /clearActiveEdgeJob/);
});

test("reuses matching job ids and avoids duplicate job creation", () => {
  assert.match(edge, /matchingRecoverableJob/);
  assert.match(edge, /recoverable\?\.jobId \?\? await createJob/);
  assert.match(edge, /segmentIndex === segmentIndex/);
  assert.match(edge, /totalSegments === totalSegments/);
  assert.match(edge, /existing\.voice === voice/);
});

test("checks stored jobs after reload and imports completed audio", () => {
  assert.match(edge, /export async function recoverActiveEdgeJobs/);
  assert.match(edge, /\/v1\/tts\/\$\{job\.jobId\}\/status/);
  assert.match(edge, /\/v1\/tts\/\$\{job\.jobId\}\/audio/);
  assert.match(app, /recoverActiveEdgeJobs\(userId/);
  assert.match(app, /appendAudioChunk\(job\.bookId, chunk\)/);
  assert.match(app, /proses sebelumnya berhasil dipulihkan/);
});

test("cleans failed and expired stored jobs", () => {
  assert.match(edge, /ACTIVE_JOB_TTL_MS/);
  assert.match(edge, /status\.status === "failed"/);
  assert.match(edge, /clearActiveEdgeJob\(userId, job\.bookId, job\.jobId\)/);
});
