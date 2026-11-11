// Builds the demo and publishes the compiled site to the gh-pages branch (GitHub Pages source: gh-pages / root).
// Usage: npm run deploy   (DEMO_REPO=<url> to publish to another repo)
// The demo lives in its own public repository (compiled site only), so the source code can stay private.
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, sep } from "node:path";

const sh = (cmd, opts = {}) => execSync(cmd, { stdio: "inherit", ...opts });
const read = (cmd) => execSync(cmd).toString().trim();

// The public demo is the presentation branch, exactly as committed: daily work on main never goes public by mistake.
if (read("git rev-parse --abbrev-ref HEAD") !== "presentation") throw new Error("La démo publique se publie depuis la branche presentation : git checkout presentation");
if (read("git status --porcelain")) throw new Error("Des modifications ne sont pas enregistrées (commit) : la démo publique doit être exactement la branche presentation.");

const TARGET = process.env.DEMO_REPO ?? "https://github.com/kitsunsystem/COFFRE-ECN.git";
const [owner, repo] = TARGET.replace(/\.git$/, "").split("/").slice(-2);
const BASE = `/${repo}`; // a project site lives under /<repo>/
const name = read("git config user.name");
const email = read("git config user.email");
const env = { ...process.env, GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: name, GIT_COMMITTER_EMAIL: email };

rmSync("out", { recursive: true, force: true });
// Always the demo: a local .env.local with production keys must never end up on the public demo.
sh("npm run build", { env: { ...process.env, PAGES_BASE_PATH: BASE, NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "", NEXT_PUBLIC_CARD_DRIVER: "" } });
writeFileSync("out/.nojekyll", ""); // otherwise Pages hides the _next/ folder

// shortcut: Next 16.4's export writes page prefetches as __next.espace/famille/__PAGE__.txt but the router asks for
// __next.espace.famille.__PAGE__.txt (a 404, then a slower fallback): a flat copy of each, until Next writes it so.
let copies = 0;
for (const file of readdirSync("out", { recursive: true })) {
  const parts = file.split(sep);
  const i = parts.findIndex((p, k) => p.startsWith("__next.") && k < parts.length - 1);
  if (i < 0 || !file.endsWith(".txt")) continue; // the folders themselves are listed too
  const flat = join("out", ...parts.slice(0, i), parts.slice(i).join("."));
  if (existsSync(flat)) continue;
  copyFileSync(join("out", file), flat);
  copies++;
}
console.log(`${copies} préchargements de pages recopiés à plat`);

// out/ becomes a throwaway one-commit repo: gh-pages only ever holds the latest build.
sh("git init -q -b gh-pages", { cwd: "out" });
sh("git -c core.autocrlf=false add -A", { cwd: "out" });
// The label shows on GitHub which version of the presentation branch is online.
sh(`git commit -q -m "Démo en ligne : branche presentation (${read("git rev-parse --short HEAD")})"`, { cwd: "out", env });
sh(`git push -f ${TARGET} gh-pages`, { cwd: "out" });
console.log(`\nPublié : https://${owner.toLowerCase()}.github.io${BASE}/`);
