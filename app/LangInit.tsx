// app/LangInit.tsx
"use client";

import { useEffect } from "react";

const DEFAULT_LANG = "en";

// Add/remove languages here anytime
const SUPPORTED_LANGS = new Set([
  "en",
  "vi",
  "fil",
  "ceb",
  "es",
  "fr",
  "de",
  "pt-BR",
  "ar",
  "zh",
  "ja",
  "ko",
]);

function normalizeLang(input: string | null): string {
  if (!input) return DEFAULT_LANG;

  const raw = String(input).trim();

  // Normalize common variants
  const lower = raw.toLowerCase();
  if (lower.startsWith("pt")) return "pt-BR";
  if (lower.startsWith("zh")) return "zh";
  if (lower.startsWith("ja")) return "ja";
  if (lower.startsWith("ko")) return "ko";
  if (lower.startsWith("ar")) return "ar";
  if (lower.startsWith("vi")) return "vi";
  if (lower.startsWith("fil") || lower.startsWith("tl")) return "fil";
  if (lower.startsWith("ceb")) return "ceb";
  if (lower.startsWith("fr")) return "fr";
  if (lower.startsWith("de")) return "de";
  if (lower.startsWith("es")) return "es";
  if (lower.startsWith("en")) return "en";

  // If exact match exists (e.g. pt-BR)
  if (SUPPORTED_LANGS.has(raw)) return raw;

  return DEFAULT_LANG;
}

export default function LangInit() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const urlLang = url.searchParams.get("lang");
    const storedLang = localStorage.getItem("gp_lang");

    const browserLang = normalizeLang(navigator.language);
    const finalLang = normalizeLang(urlLang || storedLang || browserLang);

    // Persist for all pages
    localStorage.setItem("gp_lang", finalLang);
    localStorage.setItem("i18nextLng", finalLang); // helpful if you use i18next later
    document.documentElement.lang = finalLang;

    // Ensure URL always carries ?lang= (so SEO -> app and page refresh keeps it)
    if (!urlLang || normalizeLang(urlLang) !== finalLang) {
      url.searchParams.set("lang", finalLang);
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  return null;
}
