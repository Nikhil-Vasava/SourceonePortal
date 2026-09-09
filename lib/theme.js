// Light / dark / system, remembered per browser.
//
// WHY A COOKIE AND NOT localStorage
// The server renders the first HTML. localStorage is invisible to it, so the
// page would arrive dark, then repaint light a moment later — the white flash
// every themed site used to have. A cookie rides along with the request, so
// the server can put the right data-theme on <html> straight away.
//
// It is set from the browser with document.cookie, so it is deliberately NOT
// httpOnly. That is fine: it holds the word "light", "dark" or "system" and
// nothing else. It is a display preference, not a credential — and it is
// validated on read anyway, so a hand-edited cookie can only ever produce one
// of the three known values.

export const THEME_COOKIE = "so_theme";

/** The choices a person can make. `system` follows Windows. */
export const THEMES = ["system", "light", "dark"];

export const DEFAULT_THEME = "system";

/** What the two real themes are, once `system` has been resolved. */
export const RESOLVED = ["light", "dark"];

export const THEME_LABELS = {
  system: "Match my system",
  light:  "Light",
  dark:   "Dark",
};

export const THEME_NOTES = {
  system: "Follows your Windows light/dark setting, including a day–night schedule if you use one.",
  light:  "For bright offices and daytime desks.",
  dark:   "The original look. Easier on the eyes in a dim room.",
};

/** The page background of each theme — kept here so the browser chrome can match. */
export const THEME_BG = { dark: "#0A1118", light: "#f6f8fb" };

/** Anything unrecognised becomes the default rather than throwing. */
export function normaliseTheme(value) {
  return THEMES.includes(value) ? value : DEFAULT_THEME;
}

/** Turns a choice into an actual theme. `system` needs to know what the OS says. */
export function resolveTheme(choice, prefersDark) {
  const c = normaliseTheme(choice);
  if (c !== "system") return c;
  return prefersDark ? "dark" : "light";
}

/**
 * What the server should put on <html> before it knows the OS preference.
 *
 * For an explicit choice this is simply that choice. For `system` it has to
 * guess, and it guesses dark — the app's original look, and the safer guess in
 * a warehouse office at night. The boot script below corrects it before the
 * first paint if the guess was wrong, so a wrong guess is never seen.
 */
export function serverTheme(cookieValue) {
  const c = normaliseTheme(cookieValue);
  return c === "system" ? "dark" : c;
}

/**
 * Runs in <head>, before the body renders, so the page never paints in the
 * wrong theme and then swaps.
 *
 * Deliberately tiny, dependency-free and wrapped in try/catch: this is the
 * very first thing that executes on every page load, and a browser that
 * refuses matchMedia or cookies must still get a working app, not a blank one.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{
var m=document.cookie.match(/(?:^|;\\s*)${THEME_COOKIE}=(light|dark|system)/);
var c=m?m[1]:"system";
var t=c==="system"?(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):c;
document.documentElement.setAttribute("data-theme",t);
var e=document.querySelector('meta[name="theme-color"]');
if(e)e.setAttribute("content",t==="dark"?"${THEME_BG.dark}":"${THEME_BG.light}");
}catch(_){}})();`;
