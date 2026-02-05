"use client";

import React from "react";
import { DEFAULT_LANG, normalizeLang, setLangEverywhere, type LangCode } from "../lib/lang";

type Props = {
  lang?: LangCode;
  onLangChange?: (code: LangCode) => void;
};

const LANGS: Array<{ code: LangCode; label: string }> = [
  { code: "en" as LangCode, label: "English (US)" },
  { code: "vi" as LangCode, label: "Tiếng Việt" },
  { code: "fil" as LangCode, label: "Filipino" },
  { code: "ceb" as LangCode, label: "Bisaya" },
  { code: "es" as LangCode, label: "Español" },
  { code: "ja" as LangCode, label: "日本語" },
  { code: "ko" as LangCode, label: "한국어" },
  { code: "zh" as LangCode, label: "中文(简体)" },
  { code: "ar" as LangCode, label: "العربية" },
  { code: "pt-BR" as LangCode, label: "Português (Brasil)" },
  { code: "fr" as LangCode, label: "Français (France)" },
  { code: "de" as LangCode, label: "Deutsch" },
];

export default function Navbar({ lang, onLangChange }: Props) {
  const value = (lang || DEFAULT_LANG) as LangCode;

  function choose(next: string) {
    const normalized = normalizeLang(next) as LangCode;
    onLangChange?.(normalized);
    setLangEverywhere(normalized);
  }

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-600 text-white font-bold">
            GP
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-gray-900">GreenPass</div>
            <div className="text-xs text-gray-500">Study • Work • Immigration Support</div>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          {/* ✅ Removed: Features / Services / How it works / Contact */}

          {/* Language */}
          <select
            value={value}
            onChange={(e) => choose(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="Language"
          >
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>

          {/* Primary CTA */}
          <a
            href="/directory"
            className="hidden sm:inline-flex rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Explore Directory
          </a>

        </div>
      </div>
    </header>
  );
}
