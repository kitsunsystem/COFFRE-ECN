// Builds the demo and publishes only the compiled site to the gh-pages branch of a separate PUBLIC repo,
// so the source code stays in the private repo. Usage: npm run deploy
import { execSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";

const TARGET = process.env.DEMO_REPO ?? "https://github.com/kitsunsystem/COFFRE-ECN-demo.git";
const [owner, repo] = TARGET.replace(/\.git$/, "").split("/").slice(-2);
const BASE = `/${repo}`; // a project site lives under /<repo>/

const sh = (cmd, opts = {}) => execSync(cmd, { stdio: "inherit", ...opts });
const read = (cmd) => execSync(cmd).toString().trim();
const name = read("git config user.name");
const email = read("git config user.email");
const env = { ...process.env, GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: name, GIT_COMMITTER_EMAIL: email };

rmSync("out", { recursive: true, force: true });
sh("npm run build", { env: { ...process.env, PAGES_BASE_PATH: BASE } });
writeFileSync("out/.nojekyll", ""); // otherwise Pages hides the _next/ folder

// out/ becomes a throwaway one-commit repo: gh-pages only ever holds the latest build.
sh("git init -q -b gh-pages", { cwd: "out" });
sh("git -c core.autocrlf=false add -A", { cwd: "out" });
sh('git commit -q -m "Demo en ligne"', { cwd: "out", env });
sh(`git push -f ${TARGET} gh-pages`, { cwd: "out" });
console.log(`\nPublié : https://${owner.toLowerCase()}.github.io${BASE}/`);
