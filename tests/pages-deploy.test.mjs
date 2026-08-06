import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Pages deployment uses one unique artifact per workflow attempt", async () => {
  const workflow = await readFile(new URL(".github/workflows/deploy-pages.yml", root), "utf8");

  assert.match(workflow, /PAGES_ARTIFACT_NAME: github-pages-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/);
  assert.match(workflow, /uses: actions\/upload-pages-artifact@v4[\s\S]*?name: \$\{\{ env\.PAGES_ARTIFACT_NAME \}\}/);
  assert.match(workflow, /uses: actions\/deploy-pages@v4[\s\S]*?artifact_name: \$\{\{ env\.PAGES_ARTIFACT_NAME \}\}/);
});
