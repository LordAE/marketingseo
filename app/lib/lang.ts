export type LangCode =
  | "en"
  | "vi"
  | "fil"
  | "ceb"
  | "es"
  | "ja"
  | "ko"
  | "zh"
  | "ar"
  | "pt-BR"
  | "fr"
  | "de";

export const DEFAULT_LANG: LangCode = "en";

const RTL = new Set<LangCode>(["ar"]);

/** Normalize browser/URL/localStorage values into our supported set */
export function normalizeLang(input: string): LangCode {
  const v = (input || "").toLowerCase();

  // ✅ FIX: Vietnamese support
  if (v === "vi" || v.startsWith("vi-")) return "vi";

  if (v.startsWith("fil") || v.startsWith("tl")) return "fil";
  if (v.startsWith("ceb")) return "ceb";
  if (v.startsWith("es")) return "es";
  if (v.startsWith("fr")) return "fr";
  if (v.startsWith("de")) return "de";
  if (v.startsWith("pt")) return "pt-BR";
  if (v.startsWith("ar")) return "ar";
  if (v.startsWith("zh")) return "zh";
  if (v.startsWith("ja")) return "ja";
  if (v.startsWith("ko")) return "ko";

  return "en";
}

export function getLangFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return new URL(window.location.href).searchParams.get("lang");
  } catch {
    return null;
  }
}

export function getStoredLang(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("gp_lang") || localStorage.getItem("i18nextLng");
}

export function getBrowserLang(): string | null {
  if (typeof window === "undefined") return null;
  return navigator.language || (navigator.languages?.[0] ?? null);
}

/**
 * Facebook-like: set language everywhere (storage + <html> + URL param), no reload
 */
export function setLangEverywhere(code: LangCode) {
  if (typeof window === "undefined") return;

  localStorage.setItem("gp_lang", code);
  localStorage.setItem("i18nextLng", code);

  document.documentElement.lang = code;
  document.documentElement.dir = RTL.has(code) ? "rtl" : "ltr";

  // Keep URL lang in sync (no reload)
  try {
    const u = new URL(window.location.href);
    u.searchParams.set("lang", code);
    window.history.replaceState({}, "", u.toString());
  } catch {
    // ignore
  }
}

/**
 * Resolve initial language with priority:
 * URL (?lang) → localStorage → browser locale → default
 */
export function resolveInitialLang(): LangCode {
  const fromUrl = getLangFromUrl();
  const fromStore = getStoredLang();
  const fromBrowser = getBrowserLang();
  return normalizeLang(fromUrl || fromStore || fromBrowser || DEFAULT_LANG);
}
