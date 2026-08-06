import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("exports account-scoped local audio as an ordered ZIP archive", async () => {
  const source = await readFile(new URL("app/lib/audio-export.ts", projectRoot), "utf8");
  assert.match(source, /getLocalBook\(book\.id\)/);
  assert.match(source, /new JSZip\(\)/);
  assert.match(source, /padStart\(width, "0"\)/);
  assert.match(source, /metadata\.json/);
  assert.match(source, /generateAsync\(\{ type: "blob" \}\)/);
  assert.match(source, /anchor\.download = `\$\{folderName\}-audio\.zip`/);
  assert.match(source, /URL\.revokeObjectURL/);
});

test("offers audio download from generated local library books", async () => {
  const view = await readFile(new URL("app/components/Views.tsx", projectRoot), "utf8");
  assert.match(view, /import \{ exportBookAudio \} from "\.\.\/lib\/audio-export"/);
  assert.match(view, /\[exporting\s*,\s*setExporting\]\s*=\s*useState/);
  assert.match(view, /await exportBookAudio\(book\)/);
  assert.match(view, /Unduh audio/);
  assert.match(view, /disabled=\{!item\.book\.generated\s*\|\|\s*exporting===item\.book\.id\}/);
});
