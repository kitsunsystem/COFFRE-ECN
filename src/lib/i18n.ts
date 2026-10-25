// Languages of the interface. The screens are written in French; another language is applied to the page itself:
// every text React shows is looked up in src/i18n/<lang>.json (built by scripts/i18n.mjs from src/i18n/messages.tsv).
// "{0}", "{1}"… in a text stand for the values the code inserts (a name, a number), translated too when they are known.

export const LANGS = [
  { id: "fr", label: "Français", locale: "fr-FR" },
  { id: "en", label: "English", locale: "en-GB" },
  { id: "es", label: "Español", locale: "es-ES" },
  { id: "ca", label: "Català", locale: "ca-ES" },
] as const;
export type Lang = (typeof LANGS)[number]["id"];

const KEY = "sillage-lang";
const DICTS: Record<Exclude<Lang, "fr">, () => Promise<{ default: Record<string, string> }>> = {
  en: () => import("@/i18n/en.json"),
  es: () => import("@/i18n/es.json"),
  ca: () => import("@/i18n/ca.json"),
};

// Inline in <head>: the language comes from a "?lang=" link, then from the device's choice. The page stays hidden
// until it is translated (3 s at most), so the French text never flashes.
export const LANG_BOOT = `try{var q=new URLSearchParams(location.search).get("lang"),k="${KEY}",ok=${JSON.stringify(LANGS.map((l) => l.id))};if(q&&ok.indexOf(q)>-1)localStorage.setItem(k,q);var l=localStorage.getItem(k);if(l&&l!=="fr"&&ok.indexOf(l)>-1){var h=document.documentElement;h.lang=l;h.classList.add("i18n-wait");setTimeout(function(){h.classList.remove("i18n-wait")},3000)}}catch(e){}`;

export function currentLang(): Lang {
  if (typeof document === "undefined") return "fr";
  const l = document.documentElement.lang;
  return LANGS.some((x) => x.id === l) ? (l as Lang) : "fr";
}
export const locale = () => LANGS.find((l) => l.id === currentLang())!.locale;
// "Groupe sanguin : A+" in French, "Blood type: A+" elsewhere.
export const colon = () => (currentLang() === "fr" ? " :" : ":");

// A reload shows every screen again from its French source, in the new language.
export function setLang(l: Lang) {
  try {
    localStorage.setItem(KEY, l);
  } catch {}
  const u = new URL(location.href);
  u.searchParams.delete("lang");
  location.replace(u);
}

// Dates are written with "fr-FR" throughout the code: that locale follows the chosen language. Every date is shown
// from data loaded on the device, never in the pre-built pages, so this cannot break hydration.
if (typeof document !== "undefined" && currentLang() !== "fr") {
  type Fmt = (this: Date, l?: Intl.LocalesArgument, o?: Intl.DateTimeFormatOptions) => string;
  const proto = Date.prototype as unknown as Record<string, Fmt>;
  for (const m of ["toLocaleDateString", "toLocaleString", "toLocaleTimeString"]) {
    const orig = proto[m];
    proto[m] = function (l, o) {
      return orig.call(this, l === "fr-FR" ? locale() : l, o);
    };
  }
}

// Same normalisation as scripts/i18n.mjs.
const norm = (s: string) => s.replace(/[  ]/g, " ").replace(/’/g, "'").replace(/\s+/g, " ").trim();
const exact = new Map<string, string>();
const patterns: { re: RegExp; slots: number[]; out: string }[] = [];
const seen = new Map<string, string | null>();
// Texts shown without a translation: read it from the console to complete messages.tsv.
export const missing = new Set<string>();

export function loadDict(dict: Record<string, string>) {
  exact.clear();
  patterns.length = 0;
  for (const [fr, t] of Object.entries(dict)) {
    if (!/\{\d+\}/.test(fr)) {
      exact.set(fr, t);
      continue;
    }
    const parts = fr.split(/\{(\d+)\}/);
    const re = parts.map((p, i) => (i % 2 ? "(.*?)" : p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).join("");
    patterns.push({ re: new RegExp(`^${re}$`, "s"), slots: parts.filter((_, i) => i % 2).map(Number), out: t });
  }
  // The longest fixed text first: "{0} sur {1} éléments" before "{0} sur {1}".
  patterns.sort((a, b) => b.re.source.length - a.re.source.length);
  seen.clear();
}

function lookup(k: string): string | null {
  const e = exact.get(k);
  if (e !== undefined) return e;
  for (const p of patterns) {
    const m = p.re.exec(k);
    if (!m) continue;
    // An inserted value is translated too when it is a known text ("Bonjour" in "Bonjour, Claire").
    return p.out.replace(/\{(\d+)\}/g, (_, n) => {
      const v = m[p.slots.indexOf(+n) + 1] ?? "";
      const t = /\p{L}/u.test(v) ? lookup(norm(v)) : null;
      return t === null ? v : v.match(/^\s*/)![0] + t + v.match(/\s*$/)![0];
    });
  }
  // A label the code lowercased ("Prochaine étape : vérifier votre identité.").
  const up = k.charAt(0).toUpperCase() + k.slice(1);
  if (up === k) return null;
  const t = lookup(up);
  return t === null ? null : t.charAt(0).toLowerCase() + t.slice(1);
}

// One text as the code wrote it; the spaces around it are kept (" sur " stays a word between two values).
export function tr(s: string): string {
  if (!exact.size) return s;
  const k = norm(s);
  if (!/\p{L}/u.test(k)) return s;
  let t = seen.get(k);
  if (t === undefined) {
    t = lookup(k);
    seen.set(k, t);
    if (t === null) missing.add(k);
  }
  return t === null ? s : s.match(/^\s*/)![0] + t + s.match(/\s*$/)![0];
}

// ——— The page itself ———
const SKIP = "script,style,textarea,noscript,[translate=no],.notranslate,[contenteditable=true]";
const ATTRS = ["placeholder", "aria-label", "title", "alt"];
const source = new WeakMap<Node, string>(); // text nodes: what React wrote
const attrSource = new WeakMap<Element, Record<string, string>>();

function textOf(n: Text) {
  if (!source.has(n)) source.set(n, n.data);
  return source.get(n)!;
}

// React writes a sentence with inserted values as several text nodes ("2", " sur ", "10"): they are translated
// together, the whole sentence going into the first node.
function run(nodes: Text[]) {
  const src = nodes.map(textOf);
  const whole = src.join("");
  const out = tr(whole);
  nodes.forEach((n, i) => {
    const v = out === whole ? src[i] : i ? "" : out;
    if (n.data !== v) n.data = v;
  });
}

function element(el: Element) {
  if (el.closest(SKIP)) return;
  let nodes: Text[] = [];
  const flush = () => {
    if (nodes.length) run(nodes);
    nodes = [];
  };
  for (let c = el.firstChild; c; c = c.nextSibling) {
    if (c.nodeType === Node.TEXT_NODE) nodes.push(c as Text);
    else if (c.nodeType !== Node.COMMENT_NODE) flush(); // React's <!-- --> between two texts does not split a sentence
  }
  flush();
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v === null) continue;
    const src = attrSource.get(el) ?? {};
    if (!(a in src)) attrSource.set(el, Object.assign(src, { [a]: v }));
    const t = tr(src[a]);
    if (v !== t) el.setAttribute(a, t);
  }
}

function tree(root: Element) {
  element(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  while (w.nextNode()) element(w.currentNode as Element);
}

let observer: MutationObserver | undefined;

function changed(records: MutationRecord[]) {
  const els = new Set<Element>();
  const added = new Set<Element>();
  for (const r of records) {
    if (r.type === "characterData") {
      source.set(r.target, (r.target as Text).data); // React changed the text
      if (r.target.parentElement) els.add(r.target.parentElement);
    } else if (r.type === "attributes") {
      delete attrSource.get(r.target as Element)?.[r.attributeName!];
      els.add(r.target as Element);
    } else {
      if (r.target.nodeType === Node.ELEMENT_NODE) els.add(r.target as Element);
      r.addedNodes.forEach((n) => n.nodeType === Node.ELEMENT_NODE && added.add(n as Element));
    }
  }
  added.forEach((e) => e.isConnected && tree(e));
  els.forEach((e) => e.isConnected && element(e));
  observer!.takeRecords(); // our own changes
}

// After hydration (React must find its own French text first), then on every change React makes.
export async function startI18n() {
  const lang = currentLang();
  if (lang === "fr" || observer) return;
  observer = new MutationObserver(changed);
  try {
    loadDict((await DICTS[lang]()).default);
    tree(document.documentElement);
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    Object.assign(window, { i18nMissing: missing });
  } finally {
    document.documentElement.classList.remove("i18n-wait");
  }
}
