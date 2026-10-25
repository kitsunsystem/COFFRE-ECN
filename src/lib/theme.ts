// Colour themes. The palette lives in globals.css (CSS variables); this only switches html[data-theme].
// "Noir et or" (the network's colours) is the default; a link can carry another choice: ?theme=sillage (kept on this
// device), ?theme=noir to come back.
export const THEMES = [
  { id: "noir", label: "Noir et or", hint: "Noir profond et or métallique", meta: "#07090e" },
  { id: "sillage", label: "Sillage", hint: "Crème, encre et or", meta: "#f7f2e9" },
] as const;
export type ThemeId = (typeof THEMES)[number]["id"];
export const DEFAULT_THEME: ThemeId = "noir";
const KEY = "sillage-theme";
const EVENT = "themechange";

// Runs in <head> before the first paint, so the page never flashes in the wrong colours. Kept dependency-free.
// "sillage" is the stylesheet's base palette: no attribute; any other theme sets html[data-theme].
export const THEME_BOOT = `try{var q=new URLSearchParams(location.search).get("theme"),k="${KEY}",ok=${JSON.stringify(THEMES.map((t) => t.id))};if(q&&ok.indexOf(q)>-1)localStorage.setItem(k,q);var t=localStorage.getItem(k);if(ok.indexOf(t)<0)t="${DEFAULT_THEME}";if(t!=="sillage")document.documentElement.dataset.theme=t;var c=${JSON.stringify(Object.fromEntries(THEMES.map((t) => [t.id, t.meta])))}[t],f=function(){var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",c)};f();document.addEventListener("DOMContentLoaded",f)}catch(e){}`;

export function currentTheme(): ThemeId {
  if (typeof document === "undefined") return DEFAULT_THEME;
  return (document.documentElement.dataset.theme as ThemeId) || "sillage";
}

export function setTheme(id: ThemeId) {
  const html = document.documentElement;
  if (id === "sillage") delete html.dataset.theme;
  else html.dataset.theme = id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEMES.find((t) => t.id === id)!.meta);
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Private browsing: the theme still applies until the page is closed.
  }
  window.dispatchEvent(new Event(EVENT));
}

export const subscribeTheme = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};
