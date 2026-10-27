// Interface translations. Source of truth: src/i18n/*.tsv, one text per line: French, English, Spanish, Catalan
// (tab-separated; "{0}", "{1}"… stand for the values the code inserts, like a name or a number; "\n" is a line break).
//   node scripts/i18n.mjs                  → writes src/i18n/{en,es,ca}.json and counts the texts of the code still without translation
//   node scripts/i18n.mjs --missing <file> → also writes those texts to <file>, grouped by source file
//   node scripts/i18n.mjs --check          → CI: fails if a text has no translation or the .json files are out of date
// The e-mail texts also go to supabase/functions/_shared/i18n.ts, read by the server functions (Deno).
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = path.resolve(import.meta.dirname, "..");
const LANGS = ["en", "es", "ca"];
const DIR = path.join(ROOT, "src/i18n");
const TEMPLATES = "supabase/functions/_shared/templates.ts";
const MAIL = path.join(ROOT, "supabase/functions/_shared/i18n.ts");

// Same normalisation as src/lib/i18n.ts.
const norm = (s) => s.replace(/[  ]/g, " ").replace(/’/g, "'").replace(/\s+/g, " ").trim();

const ENT = { apos: "'", quot: '"', amp: "&", lt: "<", gt: ">", nbsp: " ", laquo: "«", raquo: "»", hellip: "…", rsquo: "’", middot: "·" };
const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => (e[0] !== "#" ? (ENT[e] ?? m) : String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : +e.slice(1))));

// Babel's rule for JSX text spanning lines: trim around line breaks, drop blank lines, join with one space.
function jsxText(raw) {
  const lines = raw.split(/\r?\n/);
  if (lines.length === 1) return raw;
  return lines
    .map((l, i) => (i > 0 ? l.replace(/^[ \t]+/, "") : l))
    .map((l, i, a) => (i < a.length - 1 ? l.replace(/[ \t]+$/, "") : l))
    .filter(Boolean)
    .join(" ");
}

// Human text, not an identifier, a path or a list of CSS classes.
function human(s) {
  const lit = s.replace(/\{\d+\}/g, " ").trim();
  if ((lit.match(/\p{L}/gu) ?? []).length < 2) return false;
  if (/^(\/|https?:|\.{1,2}\/|@|#|mailto:|data:)/.test(s.trim())) return false;
  // One lowercase word is an identifier ("owner"), unless values surround it ("{0} courrier{1}").
  if ((!/\{\d+\}/.test(s) && /^[a-z0-9_.:/\-[\]]+$/.test(lit)) || /^&\w+;$/.test(lit)) return false;
  if (/[<>{}\\]|=>|\w=\w|\b(rgba?|\w+-gradient|blur)\(/.test(lit)) return false; // markup, CSS, inline scripts
  const tokens = lit.split(/\s+/);
  const code = tokens.filter((t) => /^[a-z0-9\-:[\]/.%#()!_&>*=,]+$/i.test(t) && /[-:[/]/.test(t)).length;
  return code <= tokens.length / 2;
}

const SKIP_ATTR = new Set(
  "className href src id key type name role rel target autoComplete inputMode mode variant as d viewBox fill stroke layoutId htmlFor method accept pattern enterKeyHint lang dir style strokeLinecap strokeLinejoin transform data-testid".split(" "),
);

function skipped(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isJsxAttribute(p)) return SKIP_ATTR.has(p.name.getText());
    if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isLiteralTypeNode(p)) return true;
    if (ts.isExpressionStatement(p) && p.expression === node) return true; // "use client"
    if (ts.isPropertyAssignment(p) && p.name === node) return true;
    if (ts.isCallExpression(p) && /^(console\.\w+|require|import|document\.querySelector\w*|localStorage\.\w+)$/.test(p.expression.getText())) return true;
    if (ts.isFunctionLike(p) || ts.isSourceFile(p)) return false;
  }
  return false;
}

const hasJsx = (n) => {
  let found = false;
  const walk = (x) => {
    if (found) return;
    if (ts.isJsxElement(x) || ts.isJsxSelfClosingElement(x) || ts.isJsxFragment(x)) found = true;
    else ts.forEachChild(x, walk);
  };
  walk(n);
  return found;
};

function extract() {
  const found = new Map(); // text → first file
  const mail = new Set(); // texts of the e-mail templates
  const add = (s, file) => {
    const k = norm(s);
    if (!k || !human(k)) return;
    if (!found.has(k)) found.set(k, file);
    if (file === TEMPLATES) mail.add(k);
  };
  const files = [];
  const walkDir = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walkDir(p);
      else if (/\.tsx?$/.test(e.name) && !/\.test\.|^i18n\.ts$/.test(e.name)) files.push(p);
    }
  };
  walkDir(path.join(ROOT, "src"));
  files.push(path.join(ROOT, TEMPLATES)); // e-mails: sent by the server, shown in the demo's outbox

  for (const f of files) {
    const rel = path.relative(ROOT, f).replaceAll("\\", "/");
    const sf = ts.createSourceFile(f, fs.readFileSync(f, "utf8"), ts.ScriptTarget.Latest, true, f.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    // What React puts between two elements is one run of text nodes: text and inserted values, read as one sentence.
    const runs = (children) => {
      let cur = "";
      let n = 0;
      const flush = () => {
        add(cur, rel);
        cur = "";
        n = 0;
      };
      for (const c of children) {
        if (ts.isJsxText(c)) {
          if (!(/^\s*$/.test(c.text) && c.text.includes("\n"))) cur += decode(jsxText(c.text));
        } else if (ts.isJsxExpression(c)) {
          const e = c.expression;
          if (!e) continue;
          if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) cur += e.text;
          else if (hasJsx(e)) flush();
          else cur += `{${n++}}`;
        } else flush();
      }
      flush();
    };
    const visit = (node) => {
      if (ts.isJsxElement(node) || ts.isJsxFragment(node)) runs(node.children);
      else if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !skipped(node)) add(ts.isJsxAttribute(node.parent) ? decode(node.text) : node.text, rel);
      else if (ts.isTemplateExpression(node) && !skipped(node)) add(node.head.text + node.templateSpans.map((s, i) => `{${i}}${s.literal.text}`).join(""), rel);
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return { found, mail };
}

function readTsv() {
  const rows = new Map();
  for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith(".tsv")))
    fs.readFileSync(path.join(DIR, f), "utf8")
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (!line.trim() || line.startsWith("#")) return;
      // A line with the French text alone marks a text of the code that is never translated (a name, an identifier).
      const cols = line.split("\t");
      if (cols.length !== 4 && cols.length !== 1) throw new Error(`${f}, ligne ${i + 1} : ${cols.length} colonnes au lieu de 4\n${line}`);
      rows.set(norm(cols[0]), [1, 2, 3].map((c) => (cols[c] ?? "").trim().replace(/\\n/g, "\n")));
    });
  return rows;
}

const check = process.argv.includes("--check");
const rows = readTsv();
let stale = false;
LANGS.forEach((l, i) => {
  const dict = Object.fromEntries([...rows].filter(([, t]) => t[i]).map(([fr, t]) => [fr, t[i]]).sort(([a], [b]) => (a < b ? -1 : 1)));
  const file = path.join(DIR, `${l}.json`);
  const json = JSON.stringify(dict, null, 0).replace(/","/g, '",\n"') + "\n";
  if (!check) fs.writeFileSync(file, json);
  else if (!fs.existsSync(file) || fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n") !== json) stale = true;
});

const { found, mail } = extract();
// Server side: only the e-mail texts, as a module Deno and Next.js both import.
const mailDicts = Object.fromEntries(LANGS.map((l, i) => [l, Object.fromEntries([...mail].sort().filter((k) => rows.get(k)?.[i]).map((k) => [k, rows.get(k)[i]]))]));
const mailTs = `// Generated by scripts/i18n.mjs from src/i18n/*.tsv: do not edit.\nexport const MAIL_I18N: Record<string, Record<string, string>> = ${JSON.stringify(mailDicts, null, 1)};\n`;
if (!check) fs.writeFileSync(MAIL, mailTs);
else if (!fs.existsSync(MAIL) || fs.readFileSync(MAIL, "utf8").replace(/\r\n/g, "\n") !== mailTs) stale = true;
const missing = [...found].filter(([k]) => !rows.has(k));
console.log(`${rows.size} textes traduits, ${missing.length} sans traduction sur ${found.size} trouvés dans le code.`);
// CI: every text of the code has a line in the .tsv files, and the .json files were rebuilt from them.
if (check && (missing.length || stale)) {
  missing.forEach(([k, f]) => console.error(`sans traduction (${f}) : ${k}`));
  if (stale) console.error("src/i18n/*.json ou _shared/i18n.ts pas à jour : lancez npm run i18n");
  process.exit(1);
}
const out = process.argv.indexOf("--missing");
if (out > 0) {
  let last = "";
  const lines = missing.map(([k, f]) => (f !== last ? `# ${(last = f)}\n` : "") + k);
  fs.writeFileSync(process.argv[out + 1], lines.join("\n") + "\n");
}
