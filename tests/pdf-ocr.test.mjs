import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("scanned PDFs fall back to browser OCR", async () => {
  const parser = await readFile(new URL("app/lib/document-parser.ts", root), "utf8");
  assert.match(parser, /if \(extracted\.length >= 20\) return extracted/);
  assert.match(parser, /await ocrPdf\(pdf, options\.onProgress\)/);
  assert.match(parser, /tesseract\.js@\$\{TESSERACT_VERSION\}/);
  assert.match(parser, /createWorker\("ind\+eng"/);
  assert.match(parser, /page\.render\(\{ canvasContext: context, viewport \}\)/);
  assert.match(parser, /PDF berupa hasil scan/);
});

test("document parser exposes extraction and OCR progress", async () => {
  const parser = await readFile(new URL("app/lib/document-parser.ts", root), "utf8");
  assert.match(parser, /phase: "extract" \| "ocr"/);
  assert.match(parser, /Menjalankan OCR halaman/);
  assert.match(parser, /OCR halaman \$\{index\} dari \$\{pdf\.numPages\} selesai/);
  assert.match(parser, /parseBookFile\(file: File, options: DocumentParseOptions = \{\}\)/);
});
