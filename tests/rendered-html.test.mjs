import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("exports mandatory authentication as static HTML", async () => {
  const html = await readFile(new URL("out/index.html", projectRoot), "utf8");
  assert.match(html, /<title>Apollonians Read/);
  assert.match(html, /Menyiapkan perpustakaanmu/);
  assert.doesNotMatch(html, /Lanjut tanpa akun|Mode lokal aktif/);
});

test("keeps the application behind Supabase authentication", async () => {
  const [page, gate, provider] = await Promise.all([
    readFile(new URL("app/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/components/AuthGate.tsx", projectRoot), "utf8"),
    readFile(new URL("app/lib/auth.tsx", projectRoot), "utf8"),
  ]);
  assert.match(page, /<AuthGate\s*\/>/);
  assert.match(gate, /if \(!auth\.user\) return <AuthView/);
  assert.match(provider, /signInWithPassword/);
});

test("scopes browser storage to the authenticated account", async () => {
  const [database, storage, app, player, settings, account] = await Promise.all([
    readFile(new URL("app/lib/local-db.ts", projectRoot), "utf8"),
    readFile(new URL("app/lib/account-storage.ts", projectRoot), "utf8"),
    readFile(new URL("app/components/AudiobookApp.tsx", projectRoot), "utf8"),
    readFile(new URL("app/components/AccountAudioPlayer.tsx", projectRoot), "utf8"),
    readFile(new URL("app/components/AccountSettingsView.tsx", projectRoot), "utf8"),
    readFile(new URL("app/components/AccountDialog.tsx", projectRoot), "utf8"),
  ]);
  assert.match(database, /accountBooks/);
  assert.match(database, /requireAuthenticatedUserId/);
  assert.match(storage, /apollonians-user-\$\{userId\}/);
  assert.match(app, /<AccountAudioPlayer book=\{selectedBook\} userId=\{userId\}/);
  assert.match(player, /readPlaybackPosition\(userId, book\.id\)/);
  assert.match(settings, /readAccountPreferences\(userId\)/);
  assert.match(account, /Keluar dan hapus data perangkat/);
});

test("uses Edge TTS as the authenticated online engine", async () => {
  const [client, studio, app, admin, usage, env, workflow] = await Promise.all([
    readFile(new URL("app/lib/edge-tts.ts", projectRoot), "utf8"),
    readFile(new URL("app/components/EdgeStudioView.tsx", projectRoot), "utf8"),
    readFile(new URL("app/components/AudiobookApp.tsx", projectRoot), "utf8"),
    readFile(new URL("app/lib/admin.ts", projectRoot), "utf8"),
    readFile(new URL("app/lib/usage.ts", projectRoot), "utf8"),
    readFile(new URL(".env.example", projectRoot), "utf8"),
    readFile(new URL(".github/workflows/deploy-pages.yml", projectRoot), "utf8"),
  ]);

  assert.match(client, /NEXT_PUBLIC_EDGE_TTS_ENDPOINT/);
  assert.match(client, /\/api\/tts\/generate/);
  assert.match(client, /Authorization: `Bearer \$\{token\}`/);
  assert.match(studio, /generateEdgeAudio/);
  assert.match(studio, /listEdgeVoices/);
  assert.match(studio, /previewEdgeVoice/);
  assert.match(studio, /Piper tetap tersedia sebagai fallback lokal/);
  assert.match(app, /<EdgeStudioView onCreated=\{createdBook\}/);
  assert.match(admin, /edge_tts_enabled/);
  assert.match(usage, /"piper" \| "edge"/);
  assert.match(env, /NEXT_PUBLIC_EDGE_TTS_ENDPOINT=https:\/\/apollonians\.duckdns\.org/);
  assert.doesNotMatch(env, /QWEN|service_role|sb_secret_/i);
  assert.match(workflow, /NEXT_PUBLIC_EDGE_TTS_ENDPOINT/);
  assert.doesNotMatch(workflow, /NEXT_PUBLIC_QWEN_TTS_ENDPOINT/);
});

test("provides a secure Oracle Edge TTS service and database migration", async () => {
  const [service, serviceEnv, requirements, unit, migration] = await Promise.all([
    readFile(new URL("services/edge-tts/main.py", projectRoot), "utf8"),
    readFile(new URL("services/edge-tts/.env.example", projectRoot), "utf8"),
    readFile(new URL("services/edge-tts/requirements.txt", projectRoot), "utf8"),
    readFile(new URL("services/edge-tts/apollonians-edge-tts.service", projectRoot), "utf8"),
    readFile(new URL("supabase/migrations/20260805_edge_tts.sql", projectRoot), "utf8"),
  ]);

  assert.match(service, /os\.environ\["SUPABASE_URL"\]/);
  assert.match(service, /@app\.get\("\/api\/health"\)/);
  assert.match(service, /@app\.get\("\/api\/voices"\)/);
  assert.match(service, /@app\.post\("\/api\/tts\/preview"\)/);
  assert.match(service, /@app\.post\("\/api\/tts\/generate"\)/);
  assert.match(service, /requested_engine": "edge"/);
  assert.doesNotMatch(service, /mvjcoumfhtrntcxfpuda|sb_publishable_jsyskn/);
  assert.doesNotMatch(serviceEnv, /sb_secret_|service_role/i);
  assert.match(requirements, /edge-tts==/);
  assert.match(unit, /EnvironmentFile=\/etc\/apollonians-read\/edge-tts\.env/);
  assert.match(migration, /engine in \('piper', 'edge'\)/);
  assert.match(migration, /edge_tts_enabled/);
  assert.match(migration, /where engine = 'qwen'/);
});

test("runs one PR CI and protects deployment", async () => {
  const [ci, workflow] = await Promise.all([
    readFile(new URL(".github/workflows/ci.yml", projectRoot), "utf8"),
    readFile(new URL(".github/workflows/deploy-pages.yml", projectRoot), "utf8"),
  ]);
  assert.match(ci, /pull_request:/);
  assert.doesNotMatch(ci, /push:\s*\n\s*branches:\s*\n\s*- "agent\/\*\*"/);
  assert.match(ci, /run: npm run lint/);
  assert.match(ci, /run: npm test/);
  assert.match(workflow, /Verify required deployment variables/);
  assert.match(workflow, /NEXT_PUBLIC_EDGE_TTS_ENDPOINT is required/);
  assert.match(workflow, /needs: build/);
});
