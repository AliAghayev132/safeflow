/**
 * Runs every integration test file in its OWN node process, one after the
 * other. Each file boots the real API against a freshly dropped test DB, so
 * files must never share a process (their root `before` hooks would boot two
 * servers concurrently) nor run in parallel (same DB).
 *
 *   npm run test:integration
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".test.js"))
  .sort();

let failed = 0;
for (const file of files) {
  console.log(`\n▶▶ ${file}`);
  const res = spawnSync(
    process.execPath,
    ["--test", "--test-concurrency=1", "--test-isolation=none", path.join(dir, file)],
    { stdio: "inherit", env: process.env },
  );
  if (res.status !== 0) failed += 1;
}
console.log(`\n${files.length - failed}/${files.length} integration files passed`);
process.exit(failed ? 1 : 0);
