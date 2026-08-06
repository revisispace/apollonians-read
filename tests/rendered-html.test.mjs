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
  assert.match(authProvider, /signInWithPassword/);
  assert.doesNotMatch(app, /Mode lokal/);
  assert.doesNotMatch(account, /Mode lokal aktif/);
});

test("scopes IndexedDB, playback, bookmarks, preferences, and activity to the authenticated account", async () => {
  const [database, storage, app, player, settings, account] = await Promise.all([
    readFile(new URL("app/lib/local-db.ts", projectRoot), "utf8"),
    readFile(new URL("app/lib/account-storage.ts", projectRoot), "utf8"),
    readFile(new URL("app/components/AudiobookApp.tsx", projectRoot), "utf8"),
    readFile(new URL("app/components/EnhancedAccountAudioPlayer.tsx", projectRoot), "utf8"),
    readFile(new URL("app/components/AccountSettingsView.tsx", projectRoot), "utf8"),
    readFile(new URL("app/components/AccountDialog.tsx", projectRoot), "utf8"),
  ]);

  assert.match(database, /DATABASE_VERSION = 2/);
  assert.match(database, /accountBooks/);
  assert.match(database, /"by-user"/);
  assert.match(database, /requireAuthenticatedUserId/);
  assert.match(database, /scopedBookKey\(userId, id\)/);
  assert.match(database, /claimLegacyLocalBooks/);
  assert.match(database, /clearCurrentUserLocalBooks/);
  assert.match(storage, /apollonians-user-\$\{userId\}/);
  assert.match(storage, /playbackPositionKey/);
  assert.match(storage, /bookmarksKey/);
  assert.match(storage, /readAudioBookmarks/);
  assert.match(storage, /writeAudioBookmarks/);
  assert.match(storage, /preferencesKey/);
  assert.match(storage, /activityKey/);
  assert.match(storage, /clearAccountLocalStorage/);
  assert.match(app, /claimLegacyLocalBooks/);
  assert.match(app, /readAccountActivity\(userId\)/);
  assert.match(app, /<AccountAudioPlayer book=\{selectedBook\} userId=\{userId\}/);
  assert.match(app, /<AccountSettingsView key=\{userId\} userId=\{userId\}/);
  assert.match(player, /readPlaybackPosition\(userId, book\.id\)/);
  assert.match(player, /writePlaybackPosition\(userId, book\.id/);
  assert.match(player, /readAudioBookmarks\(userId, book\.id\)/);
  assert.match(player, /writeAudioBookmarks\(userId, book\.id, updated\)/);
  assert.match(player, /const addBookmark/);
  assert.match(player, /Bookmark dan catatan/);
  assert.match(player, /const saveBookmarkNote/);
  assert.match(player, /const deleteBookmark/);
  assert.match(settings, /readAccountPreferences\(userId\)/);
  assert.match(settings, /writeAccountPreferences\(userId, next\)/);
  assert.match(account, /Keluar dan hapus data perangkat/);
  assert.match(account, /clearCurrentUserLocalBooks/);
  assert.match(account, /clearAccountLocalStorage\(userId\)/);
});

test("shows Edge TTS while preserving the existing Oracle and Supabase contracts", async () => {
  const [client, studio, app, admin, usage, schema, env, workflow] = await Promise.all([
    readFile(new URL("app/lib/edge-tts.ts", projectRoot), "utf8"),
    readFile(new URL("app/components/EdgeStudioView.tsx", projectRoot), "utf8"),
    readFile(new URL("app/components/AudiobookApp.tsx", projectRoot), "utf8"),
    readFile(new URL("app/lib/admin.ts", projectRoot), "utf8"),
    readFile(new URL("app/lib/usage.ts", projectRoot), "utf8"),
    readFile(new URL("supabase/schema.sql", projectRoot), "utf8"),
    readFile(new URL(".env.example", projectRoot), "utf8"),
    readFile(new URL(".github/workflows/deploy-pages.yml", projectRoot), "utf8"),
  ]);

  assert.match(client, /NEXT_PUBLIC_QWEN_TTS_ENDPOINT/);
  assert.match(client, /\/health/);
  assert.match(client, /\/v1\/tts/);
  assert.match(client, /\/v1\/tts\/\$\{(?:jobId|job\.jobId)\}\/status/);
  assert.match(client, /\/v1\/tts\/\$\{(?:jobId|job\.jobId)\}\/audio/);
  assert.match(client, /Authorization: `Bearer \$\{token\}`/);
  assert.match(client, /speaker: voice/);
  assert.match(client, /id: "Ryan"/);
  assert.match(client, /id: "Jenny"/);
  assert.match(studio, /useState\("Ryan"\)/);
  assert.match(studio, /previewEdgeVoice\(\{ voice \}\)/);
  assert.match(studio, /generateEdgeAudio\([\s\S]*voice: nextItem\.voice/);
  assert.match(studio, /Edge TTS online/);
  assert.match(studio, /Piper lokal/);
  assert.match(studio, /ANTREAN AUDIOBOOK/);
  assert.match(studio, /Tambahkan ke antrean/);
  assert.doesNotMatch(studio, /type="range"/);
  assert.doesNotMatch(studio, /id-ID-ArdiNeural/);
  assert.doesNotMatch(studio, /Kecepatan \(/);
  assert.doesNotMatch(studio, /Pitch \(/);
  assert.doesNotMatch(studio, /Volume \(/);
  assert.match(app, /<EdgeStudioView onCreated=\{createdBook\} userId=\{userId\}/);
  assert.match(admin, /qwen_enabled: settings\.edge_tts_enabled/);
  assert.match(usage, /"piper" \| "qwen"/);
  assert.match(schema, /qwen_enabled/);
  assert.match(schema, /engine in \('piper', 'qwen'\)/);
  assert.doesNotMatch(schema, /edge_tts_enabled/);
  assert.match(env, /NEXT_PUBLIC_QWEN_TTS_ENDPOINT/);
  assert.match(workflow, /NEXT_PUBLIC_QWEN_TTS_ENDPOINT/);
});

test("runs pull request CI once and protects production deployment", async () => {
  const [ci, workflow] = await Promise.all([
    readFile(new URL(".github/workflows/ci.yml", projectRoot), "utf8"),
    readFile(new URL(".github/workflows/deploy-pages.yml", projectRoot), "utf8"),
  ]);

  assert.match(ci, /pull_request:/);
  assert.doesNotMatch(ci, /push:\s*\n\s*branches:\s*\n\s*- "agent\/\*\*"/);
  assert.match(ci, /run: npm run lint/);
  assert.match(ci, /run: npm test/);
  assert.match(workflow, /Verify required deployment variables/);
  assert.match(workflow, /NEXT_PUBLIC_SUPABASE_URL is required/);
  assert.match(workflow, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required/);
  assert.match(workflow, /run: npm run lint/);
  assert.match(workflow, /run: npm test/);
  assert.match(workflow, /needs: build/);
});

test("does not expose server secrets and keeps admin access role-gated", async () => {
  const [exampleEnv, worker, schema, app, admin] = await Promise.all([
    readFile(new URL(".env.example", projectRoot), "utf8"),
    readFile(new URL("services/qwen-tts/main.py", projectRoot), "utf8"),
    readFile(new URL("supabase/schema.sql", projectRoot), "utf8"),
    readFile(new URL("app/components/AudiobookApp.tsx", projectRoot), "utf8"),
    readFile(new URL("app/components/AdminView.tsx", projectRoot), "utf8"),
  ]);

  assert.doesNotMatch(worker, /SERVICE_ROLE|sb_secret_/);
  assert.doesNotMatch(exampleEnv, /SUPABASE_SERVICE_ROLE_KEY=|sb_secret_[A-Za-z0-9]/);
  assert.match(schema, /enable row level security/);
  assert.match(schema, /auth\.uid\(\)/);
  assert.match(app, /auth\.isSuperadmin/);
  assert.match(admin, /Pengendalian konsumsi/);
});
