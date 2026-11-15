import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const viewerRoot = resolve(here, "..");
const repoRoot = resolve(viewerRoot, "..");
const publicDir = resolve(viewerRoot, "public");

rmSync(publicDir, { recursive: true, force: true });
mkdirSync(publicDir, { recursive: true });

for (const name of ["examples", "schema"]) {
  cpSync(resolve(repoRoot, name), resolve(publicDir, name), {
    recursive: true,
  });
}

console.log("Copied examples/ and schema/ into viewer/public/");
