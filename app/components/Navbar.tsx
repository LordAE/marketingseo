"use client";

import React from "react";
import { normalizeLang, setLangEverywhere, type LangCode } from "../lib/lang";

type NavItem = {
  label: string;
  href: string;
};

type NavbarProps = {
  lang?: string;
  t?: Record<string, string>;
  onLangChange?: (code: LangCode) => void;
};

const APP_BASE = "https://app.greenpassgroup.com";

/**
 * ✅ Hydration-safe absolute link builder:
 * Always returns: https://app.greenpassgroup.com/<path>?lang=<lang>
 * No window, no URL(), so SSR/client output matches.
 */
function appLink(path: string, lang: string) {
  const cleanPath = (path || "/").startsWith("/") ? path : `/${path}`;
  const code = lang || "en";
  const sep = cleanPath.includes("?") ? "&" : "?";
  return `${APP_BASE}${cleanPath}${sep}lang=${encodeURIComponent(code)}`;
}

export default function Navbar({ lang = "en", t = {}, onLangChange }: NavbarProps) {
  const [open, setOpen] = React.useState(false);
  const [langOpen, setLangOpen] = React.useState(false);
  const langWrapRef = React.useRef<HTMLDivElement | null>(null);

  // Close language menu when clicking outside
  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const el = langWrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      setLangOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const LANGS: Array<{ code: LangCode; label: string }> = [
    { code: "en", label: "English (US)" },
    { code: "vi", label: "Tiếng Việt" },
    { code: "fil", label: "Filipino" },
    { code: "ceb", label: "Bisaya" },
    { code: "es", label: "Español" },
    { code: "fr", label: "Français" },
    { code: "de", label: "Deutsch" },
    { code: "pt-BR", label: "Português (Brasil)" },
    { code: "ar", label: "العربية" },
    { code: "zh", label: "中文(简体)" },
    { code: "ja", label: "日本語" },
    { code: "ko", label: "한국어" },
  ];

  function chooseLanguage(code: LangCode) {
    const normalized = normalizeLang(code) as LangCode;
    // Update global lang + URL param
    setLangEverywhere(normalized);
    // Let parent update text strings/state
    onLangChange?.(normalized);
    setLangOpen(false);
  }

  const items: NavItem[] = [
    { label: t.features ?? "Features", href: "#features" },
    { label: t.services ?? "Services", href: "#services" },
    { label: t.how ?? "How it works", href: "#how" },
    { label: t.contact ?? "Contact", href: "#contact" },
  ];

  const tagline = t.brand_tagline ?? "Study • Work • Immigration Support";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        {/* Brand */}
        <a href="#top" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold">
            GP
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-zinc-900">GreenPass</div>
            <div className="text-xs text-zinc-500">{tagline}</div>
          </div>
        </a>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex">
          {items.map((it) => (
            <a
              key={it.href}
              href={it.href}
              className="text-sm text-zinc-700 hover:text-zinc-900"
            >
              {it.label}
            </a>
          ))}
        </nav>

        {/* Right actions (desktop) */}
        <div className="hidden items-center gap-3 md:flex">
          {/* Language selector */}
          <div ref={langWrapRef} className="relative">
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-3 text-sm text-zinc-900 transition hover:bg-zinc-50"
              aria-label="Choose language"
              onClick={() => setLangOpen((v) => !v)}
            >
              <span className="text-base">🌐</span>
              <span className="hidden lg:inline">{lang}</span>
              <span className="text-xs">▾</span>
            </button>

            {langOpen && (
              <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
                <div className="max-h-72 overflow-auto py-1">
                  {LANGS.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-zinc-50 ${
                        String(lang) === l.code ? "font-semibold text-zinc-900" : "text-zinc-700"
                      }`}
                      onClick={() => chooseLanguage(l.code)}
                    >
                      <span>{l.label}</span>
                      {String(lang) === l.code ? <span>✓</span> : null}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <a
            className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm text-zinc-900 transition hover:bg-zinc-50"
            href={appLink("/directory", lang)}
          >
            {t.cta_directory ?? "Explore Directory"}
          </a>

          <a
            className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-900 px-4 text-sm text-white transition hover:bg-zinc-800"
            href={appLink("/welcome", lang)}
          >
            {t.cta_login ?? "Login to App"}
          </a>
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-900"
          aria-label="Open menu"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="text-lg">☰</span>
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden border-t border-zinc-200 bg-white">
          <div className="mx-auto max-w-5xl px-6 py-4">
            <nav className="flex flex-col gap-3">
              {items.map((it) => (
                <a
                  key={it.href}
                  href={it.href}
                  className="text-sm text-zinc-700 hover:text-zinc-900"
                  onClick={() => setOpen(false)}
                >
                  {it.label}
                </a>
              ))}

              <div className="mt-3 flex flex-col gap-2">
                {/* Language selector (mobile) */}
                <div className="rounded-xl border border-zinc-200 p-3">
                  <div className="mb-2 text-xs font-semibold text-zinc-600">Language</div>
                  <div className="flex flex-wrap gap-2">
                    {LANGS.map((l) => (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => chooseLanguage(l.code)}
                        className={`rounded-full border px-3 py-1 text-xs transition ${
                          String(lang) === l.code
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                        }`}
                      >
                        {l.code}
                      </button>
                    ))}
                  </div>
                </div>

                <a
                  className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm text-zinc-900 transition hover:bg-zinc-50"
                  href={appLink("/directory", lang)}
                  onClick={() => setOpen(false)}
                >
                  {t.cta_directory ?? "Explore Directory"}
                </a>

                <a
                  className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-900 px-4 text-sm text-white transition hover:bg-zinc-800"
                  href={appLink("/welcome", lang)}
                  onClick={() => setOpen(false)}
                >
                  {t.cta_login ?? "Login to App"}
                </a>
              </div>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
