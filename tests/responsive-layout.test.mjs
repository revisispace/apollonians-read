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
  assert.doesNotMatch(css, /player-tools\s*\{[^}]*display:\s*none/);
});

test("uses single-column mobile cards and bottom-sheet dialogs", async () => {
  const css = await readFile(new URL("app/responsive.css", projectRoot), "utf8");

  assert.match(css, /@media \(max-width:\s*760px\)/);
  assert.match(css, /continue-grid, \.library-grid, \.lower-grid, \.activity-summary,[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(css, /dialog-backdrop\s*\{\s*align-items:\s*end/);
  assert.match(css, /max-height:\s*min\(88dvh,\s*760px\)/);
  assert.match(css, /admin-table\s*\{\s*min-width:\s*680px/);
});
