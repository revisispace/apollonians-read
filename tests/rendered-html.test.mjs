import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("exports the mandatory authentication gate as static HTML", async () => {
  const html = await readFile(new URL("out/index.html", projectRoot), "utf8");
  assert.match(html, /<title>Apollonians Read/);
  assert.match(html, /Menyiapkan perpustakaanmu/);
  assert.match(html, /Memeriksa sesi akun dengan aman/);
  assert.doesNotMatch(html, /Mode lokal aktif|Lanjut tanpa akun|Selamat datang kembali, Nabila/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("requires Supabase authentication before rendering the application", async () => {
  const [page, gate, authView, authProvider, app, account] = await Promise.all([
    readFile(new URL("app/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/components/AuthGate.tsx", projectRoot), "utf8"),
    readFile(new URL("app/components/AuthView.tsx", projectRoot), "utf8"),
    readFile(new URL("app/lib/auth.tsx", projectRoot), "utf8"),
    readFile(new URL("app/components/AudiobookApp.tsx", projectRoot), "utf8"),
    readFile(new URL("app/components/AccountDialog.tsx", projectRoot), "utf8"),
  ]);

  assert.match(page, /<AuthGate\s*\/>/);
  assert.match(gate, /if \(!auth\.user\) return <AuthView/);
  assert.match(gate, /if \(!auth\.configured\)/);
  assert.match(authView, /Masuk ke perpustakaanmu/);
  assert.match(authView, /Buat akun gratis/);
  assert.match(authView, /Atur ulang password/);
  assert.match(authProvider, /signInWithPassword/);
  assert.match(authProvider, /resetPasswordForEmail/);
  assert.doesNotMatch(app, /Mode lokal|accountLabel=\{auth\.user\?\.email \?\? "Lokal"/);
  assert.doesNotMatch(account, /Mode lokal aktif|Simpan progres di cloud/);
});

test("protects deployment and client code without exposing server secrets", async () => {
  const [exampleEnv, gitignore, client, piper, qwen, worker, workflow, schema] = await Promise.all([
    readFile(new URL(".env.example", projectRoot), "utf8"),
    readFile(new URL(".gitignore", projectRoot), "utf8"),
    readFile(new URL("app/components/Views.tsx", projectRoot), "utf8"),
    readFile(new URL("app/lib/piper.ts", projectRoot), "utf8"),
    readFile(new URL("app/lib/qwen.ts", projectRoot), "utf8"),
    readFile(new URL("services/qwen-tts/main.py", projectRoot), "utf8"),
    readFile(new URL(".github/workflows/deploy-pages.yml", projectRoot), "utf8"),
    readFile(new URL("supabase/schema.sql", projectRoot), "utf8"),
  ]);

  assert.match(client, /generateIndonesianAudio/);
  assert.match(piper, /id_ID-news_tts-medium/);
  assert.match(qwen, /NEXT_PUBLIC_QWEN_TTS_ENDPOINT/);
  assert.match(worker, /reserve_generation/);
  assert.match(worker, /SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(worker, /SERVICE_ROLE|sb_secret_/);
  assert.doesNotMatch(client, /OPENAI_API_KEY|DASHSCOPE_API_KEY|Authorization:\s*`Bearer/);
  assert.match(exampleEnv, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(exampleEnv, /OPENAI_API_KEY|DASHSCOPE_API_KEY|SUPABASE_SERVICE_ROLE_KEY=|sb_secret_[A-Za-z0-9]/);
  assert.match(gitignore, /^\.env\*$/m);

  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /Verify required deployment variables/);
  assert.match(workflow, /NEXT_PUBLIC_SUPABASE_URL is required/);
  assert.match(workflow, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required/);
  assert.match(workflow, /run: npm run lint/);
  assert.match(workflow, /run: npm test/);
  assert.match(workflow, /needs: build/);

  assert.match(schema, /enable row level security/);
  assert.match(schema, /auth\.uid\(\)/);
  assert.match(schema, /private\.is_superadmin/);
  assert.match(schema, /reserve_generation/);
});

test("includes catalog management and a role-gated admin dashboard", async () => {
  const [app, library, admin] = await Promise.all([
    readFile(new URL("app/components/AudiobookApp.tsx", projectRoot), "utf8"),
    readFile(new URL("app/components/Views.tsx", projectRoot), "utf8"),
    readFile(new URL("app/components/AdminView.tsx", projectRoot), "utf8"),
  ]);

  assert.match(app, /auth\.isSuperadmin/);
  assert.match(app, /deleteCloudBook/);
  assert.match(library, /Ubah judul/);
  assert.match(library, /Hapus/);
  assert.match(admin, /Pengendalian konsumsi/);
});
