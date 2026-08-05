import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("loads functional header tool styles after other responsive styles", async () => {
  const layout = await readFile(new URL("app/layout.tsx", projectRoot), "utf8");
  const mobilePlayerIndex = layout.indexOf('import "./mobile-player.css"');
  const headerToolsIndex = layout.indexOf('import "./header-tools.css"');
  assert.ok(mobilePlayerIndex >= 0);
  assert.ok(headerToolsIndex > mobilePlayerIndex);
});

test("global search exposes keyboard shortcut, results, clear, and mobile trigger", async () => {
  const [header, app, styles] = await Promise.all([
    readFile(new URL("app/components/AppHeader.tsx", projectRoot), "utf8"),
    readFile(new URL("app/components/AudiobookApp.tsx", projectRoot), "utf8"),
    readFile(new URL("app/header-tools.css", projectRoot), "utf8"),
  ]);

  assert.match(header, /event\.metaKey \|\| event\.ctrlKey/);
  assert.match(header, /event\.key\.toLowerCase\(\) === "k"/);
  assert.match(header, /searchResults\.map/);
  assert.match(header, /onSelectSearchResult/);
  assert.match(header, /search-clear/);
  assert.match(header, /mobile-search-button/);
  assert.match(app, /title} \$\{book\.author} \$\{book\.category/);
  assert.match(app, /setActive\("library"\)/);
  assert.match(styles, /\.header-search\.is-open \.search-field/);
});

test("notification panel tracks unread state and routes actionable events", async () => {
  const [header, app, styles] = await Promise.all([
    readFile(new URL("app/components/AppHeader.tsx", projectRoot), "utf8"),
    readFile(new URL("app/components/AudiobookApp.tsx", projectRoot), "utf8"),
    readFile(new URL("app/header-tools.css", projectRoot), "utf8"),
  ]);

  assert.match(header, /notifications\.filter\(\(item\) => item\.unread\)/);
  assert.match(header, /onMarkAllNotificationsRead/);
  assert.match(header, /onOpenNotification/);
  assert.match(header, /notification-popover/);
  assert.match(app, /pushNotification\("Audiobook selesai dibuat"/);
  assert.match(app, /item\.id === notification\.id \? \{ \.\.\.item, unread: false \}/);
  assert.match(app, /if \(notification\.target\) setActive\(notification\.target\)/);
  assert.match(styles, /notification-popover > button\.unread/);
  assert.match(styles, /notification-dot/);
});
