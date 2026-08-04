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

test("uses local Piper and optional Supabase without exposing server secrets", async () => {
  const [exampleEnv, gitignore, client, piper, workflow, schema] = await Promise.all([
    readFile(new URL(".env.example", projectRoot), "utf8"),
    readFile(new URL(".gitignore", projectRoot), "utf8"),
    readFile(new URL("app/components/Views.tsx", projectRoot), "utf8"),
    readFile(new URL("app/lib/piper.ts", projectRoot), "utf8"),
    readFile(new URL(".github/workflows/deploy-pages.yml", projectRoot), "utf8"),
    readFile(new URL("supabase/schema.sql", projectRoot), "utf8"),
  ]);

  assert.match(client, /generateIndonesianAudio/);
  assert.match(piper, /id_ID-news_tts-medium/);
  assert.doesNotMatch(client, /OPENAI_API_KEY|DASHSCOPE_API_KEY|Authorization:\s*`Bearer/);
  assert.match(exampleEnv, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(exampleEnv, /OPENAI_API_KEY|DASHSCOPE_API_KEY|SUPABASE_SERVICE_ROLE_KEY=|sb_secret_[A-Za-z0-9]/);
  assert.match(gitignore, /^\.env\*$/m);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /npm run build:pages/);
  assert.match(schema, /enable row level security/);
  assert.match(schema, /auth\.uid\(\)/);
});
