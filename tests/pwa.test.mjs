import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("exports an installable PWA without changing server infrastructure", async () => {
  const [html, manifest, worker, registration, layout] = await Promise.all([
    readFile(new URL("out/index.html", projectRoot), "utf8"),
    readFile(new URL("out/manifest.webmanifest", projectRoot), "utf8"),
    readFile(new URL("out/sw.js", projectRoot), "utf8"),
    readFile(new URL("app/components/ServiceWorkerRegistration.tsx", projectRoot), "utf8"),
    readFile(new URL("app/layout.tsx", projectRoot), "utf8"),
  ]);

  const parsedManifest = JSON.parse(manifest);
  assert.equal(parsedManifest.name, "Apollonians Read");
  assert.equal(parsedManifest.display, "standalone");
  assert.equal(parsedManifest.start_url, "./");
  assert.equal(parsedManifest.scope, "./");
  assert.match(html, /manifest\.webmanifest/);
  assert.match(layout, /manifest: "manifest\.webmanifest"/);
  assert.match(registration, /serviceWorker\.register\("\.\/sw\.js"/);
  assert.match(worker, /APP_SHELL/);
  assert.match(worker, /event\.request\.mode === "navigate"/);
  assert.doesNotMatch(worker, /apollonians\.duckdns\.org|SUPABASE_/);
});
