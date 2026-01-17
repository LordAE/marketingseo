export type LangCode = "en" | "fil" | "ceb" | "es" | "fr" | "de" | "pt-BR" | "ar" | "zh" | "ja" | "ko";

export const DEFAULT_LANG: LangCode = "en";

export function normalizeLang(input: string): LangCode {
  const v = (input || "").toLowerCase();

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
  return new URL(window.location.href).searchParams.get("lang");
}

export function getStoredLang(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("gp_lang") || localStorage.getItem("i18nextLng");
}

export function getBrowserLang(): string | null {
  if (typeof window === "undefined") return null;
  // e.g. "en-US", "fil-PH"
  return navigator.language || (navigator.languages?.[0] ?? null);
}

export function setLangEverywhere(code: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("gp_lang", code);
  localStorage.setItem("i18nextLng", code);
  document.documentElement.lang = code;
}
