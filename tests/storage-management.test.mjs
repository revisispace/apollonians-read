import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("summarizes local storage and removes audio without deleting book records", async () => {
  const localDb = await readFile(new URL("app/lib/local-db.ts", projectRoot), "utf8");

  assert.match(localDb, /export type LocalBookStorageSummary/);
  assert.match(localDb, /listLocalStorageSummaries/);
  assert.match(localDb, /audioChunks\.reduce\(\(total, chunk\) => total \+ chunk\.size/);
  assert.match(localDb, /export async function removeLocalAudio/);
  assert.match(localDb, /audioChunks: \[\]/);
  assert.match(localDb, /book: \{ \.\.\.asset\.book, generated: false \}/);
  assert.doesNotMatch(localDb, /removeLocalAudio[\s\S]{0,1200}transaction\.store\.delete/);
});

test("provides per-book, bulk, quota, and high-usage storage controls", async () => {
  const [component, styles] = await Promise.all([
    readFile(new URL("app/components/StorageManagement.tsx", projectRoot), "utf8"),
    readFile(new URL("app/storage-management.css", projectRoot), "utf8"),
  ]);

  assert.match(component, /navigator\.storage|estimateLocalStorage/);
  assert.match(component, /Hapus audio terpilih/);
  assert.match(component, /Hapus audio lokal/);
  assert.match(component, /Penyimpanan perangkat hampir penuh/);
  assert.match(component, /Metadata buku tetap disimpan/);
  assert.match(styles, /storage-metrics/);
  assert.match(styles, /@media \(max-width: 760px\)/);
});

test("embeds storage management in account settings and refreshes player metadata", async () => {
  const [settings, app, layout] = await Promise.all([
    readFile(new URL("app/components/AccountSettingsView.tsx", projectRoot), "utf8"),
    readFile(new URL("app/components/AudiobookApp.tsx", projectRoot), "utf8"),
    readFile(new URL("app/layout.tsx", projectRoot), "utf8"),
  ]);

  assert.match(settings, /<StorageManagement onAudioRemoved=\{onAudioRemoved\}/);
  assert.match(app, /handleAudioRemoved/);
  assert.match(app, /generated: false/);
  assert.match(app, /Penyimpanan dibersihkan/);
  assert.match(layout, /import "\.\/storage-management\.css"/);
});
