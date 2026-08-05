import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("Edge TTS requests and jobs have bounded timeouts", async () => {
  const source = await readFile(new URL("app/lib/edge-tts.ts", projectRoot), "utf8");

  assert.match(source, /REQUEST_TIMEOUT_MS\s*=\s*30_000/);
  assert.match(source, /JOB_TIMEOUT_MS\s*=\s*5 \* 60_000/);
  assert.match(source, /AbortController/);
  assert.match(source, /while \(Date\.now\(\) < deadline\)/);
  assert.doesNotMatch(source, /for \(;;\)/);
});

test("status and audio reads retry transient failures without retrying job creation", async () => {
  const source = await readFile(new URL("app/lib/edge-tts.ts", projectRoot), "utf8");

  assert.match(source, /TRANSIENT_RETRIES\s*=\s*2/);
  assert.match(source, /isTransientStatus/);
  assert.match(source, /\/status`, undefined, TRANSIENT_RETRIES/);
  assert.match(source, /\/audio`, undefined, TRANSIENT_RETRIES/);
  assert.match(source, /authedFetch\(token, "\/v1\/tts", \{/);
});

test("audio generation resumes from locally completed segments", async () => {
  const source = await readFile(new URL("app/lib/edge-tts.ts", projectRoot), "utf8");

  assert.match(source, /completedSegments = Math\.min\(Math\.max\(0, Math\.floor\(skipCount\)\), segments\.length\)/);
  assert.match(source, /for \(let index = completedSegments; index < segments\.length; index \+= 1\)/);
  assert.match(source, /resumedFrom: completedSegments/);
  assert.match(source, /bagian terakhir yang tersimpan/);
});
