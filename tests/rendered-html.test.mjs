import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("exports the Apollonians Read application as static HTML", async () => {
  const html = await readFile(new URL("out/index.html", projectRoot), "utf8");
  assert.match(html, /<title>Apollonians Read/);
  assert.match(html, /Selamat datang kembali, Nabila/);
  assert.match(html, /The Anthropocene Reviewed/);
  assert.match(html, /Buat audiobook/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("uses browser speech without exposing API keys", async () => {
  const [exampleEnv, gitignore, client, workflow] = await Promise.all([
    readFile(new URL(".env.example", projectRoot), "utf8"),
    readFile(new URL(".gitignore", projectRoot), "utf8"),
    readFile(new URL("app/components/Views.tsx", projectRoot), "utf8"),
    readFile(new URL(".github/workflows/deploy-pages.yml", projectRoot), "utf8"),
  ]);

  assert.match(client, /speechSynthesis/);
  assert.doesNotMatch(client, /OPENAI_API_KEY|DASHSCOPE_API_KEY|Authorization:\s*`Bearer/);
  assert.doesNotMatch(exampleEnv, /OPENAI_API_KEY|DASHSCOPE_API_KEY/);
  assert.match(gitignore, /^\.env\*$/m);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /npm run build:pages/);
});
