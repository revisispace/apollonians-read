import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("loads responsive overrides after the base stylesheet", async () => {
  const layout = await readFile(new URL("app/layout.tsx", projectRoot), "utf8");
  const baseIndex = layout.indexOf('import "./globals.css"');
  const responsiveIndex = layout.indexOf('import "./responsive.css"');

  assert.ok(baseIndex >= 0);
  assert.ok(responsiveIndex > baseIndex);
});

test("prevents horizontal overflow and uses fluid content grids", async () => {
  const css = await readFile(new URL("app/responsive.css", projectRoot), "utf8");

  assert.match(css, /overflow-x:\s*clip/);
  assert.match(css, /library-grid[^}]*repeat\(auto-fit,\s*minmax\(250px,\s*1fr\)\)/s);
  assert.match(css, /continue-grid[^}]*repeat\(auto-fit,\s*minmax\(250px,\s*1fr\)\)/s);
  assert.match(css, /admin-settings-grid[^}]*repeat\(auto-fit,\s*minmax\(220px,\s*1fr\)\)/s);
});

test("keeps player navigation tools available on tablet and mobile", async () => {
  const css = await readFile(new URL("app/responsive.css", projectRoot), "utf8");

  assert.match(css, /The player tools were previously hidden on tablets/);
  assert.match(css, /player-tools\s*\{[\s\S]*display:\s*flex/);
  assert.match(css, /grid-template-areas:\s*"book center"\s*"tools tools"/);
  assert.match(css, /bottom:\s*calc\(63px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /audio-player\.is-unavailable \.player-tools\s*\{\s*display:\s*none/);
});

test("resets the tablet sidebar offset before rendering the mobile shell", async () => {
  const css = await readFile(new URL("app/responsive.css", projectRoot), "utf8");

  assert.match(css, /@media \(max-width:\s*1100px\)[\s\S]*\.app-column\s*\{\s*margin-left:\s*208px/);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*\.app-column\s*\{\s*margin-left:\s*0;/);
  assert.match(css, /\.app-shell, \.app-column, main\s*\{\s*width:\s*100%;\s*max-width:\s*100%;/);
});

test("uses single-column mobile cards and bottom-sheet dialogs", async () => {
  const css = await readFile(new URL("app/responsive.css", projectRoot), "utf8");

  assert.match(css, /@media \(max-width:\s*760px\)/);
  assert.match(css, /continue-grid, \.library-grid, \.lower-grid, \.activity-summary,[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(css, /dialog-backdrop\s*\{\s*align-items:\s*end/);
  assert.match(css, /max-height:\s*min\(88dvh,\s*760px\)/);
  assert.match(css, /admin-table\s*\{\s*min-width:\s*680px/);
  assert.match(css, /audio-player\.is-unavailable\s*\{[^}]*min-height:\s*74px/s);
});

test("keeps account actions styled and aligns preview with the voice field", async () => {
  const css = await readFile(new URL("app/responsive.css", projectRoot), "utf8");

  assert.match(css, /account-dialog > \.dark-button,[\s\S]*account-dialog > \.delete-book/);
  assert.match(css, /account-dialog > \.delete-book\s*\{[^}]*border:\s*1px solid/s);
  assert.match(css, /creator-card > \.setting-grid \+ \.setting-grid \.preview-button\s*\{[^}]*grid-column:\s*2/s);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*preview-button\s*\{\s*grid-column:\s*1/s);
});
