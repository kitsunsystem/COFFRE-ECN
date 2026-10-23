// Builds the demo for GitHub Pages and publishes out/ to the gh-pages branch of the "origin" remote.
// Usage: npm run deploy   →   https://kitsunsystem.github.io/COFFRE-ECN/
import { execSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";

const BASE = "/COFFRE-ECN";
const sh = (cmd, opts = {}) => execSync(cmd, { stdio: "inherit", ...opts });
const read = (cmd) => execSync(cmd).toString().trim();

const remote = read("git remote get-url origin");
const author = { GIT_AUTHOR_NAME: read("git config user.name"), GIT_AUTHOR_EMAIL: read("git config user.email") };
const env = { ...process.env, ...author, GIT_COMMITTER_NAME: author.GIT_AUTHOR_NAME, GIT_COMMITTER_EMAIL: author.GIT_AUTHOR_EMAIL };

rmSync("out", { recursive: true, force: true });
sh("npm run build", { env: { ...process.env, PAGES_BASE_PATH: BASE } });
writeFileSync("out/.nojekyll", ""); // otherwise Pages hides the _next/ folder

// out/ becomes a throwaway one-commit repo: the gh-pages branch only ever holds the latest build.
sh("git init -q -b gh-pages", { cwd: "out" });
sh("git add -A", { cwd: "out" });
sh('git commit -q -m "Demo en ligne"', { cwd: "out", env });
sh(`git push -f ${remote} gh-pages`, { cwd: "out" });
console.log(`\nPublié : https://kitsunsystem.github.io${BASE}/`);
