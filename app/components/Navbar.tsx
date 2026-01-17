"use client";

import React from "react";

type NavItem = {
  label: string;
  href: string;
};

function withLang(url: string, lang: string) {
  try {
    const u = new URL(url);
    u.searchParams.set("lang", lang || "en");
    return u.toString();
  } catch {
    // allow hash links like #features
    return url;
  }
}

export default function Navbar({ lang = "en" }: { lang?: string }) {
  const [open, setOpen] = React.useState(false);

  const items: NavItem[] = [
    { label: "Features", href: "#features" },
    { label: "Services", href: "#services" },
    { label: "How it works", href: "#how" },
    { label: "Contact", href: "#contact" },
  ];

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
            <div className="text-xs text-zinc-500">Study • Work • Immigration</div>
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

        {/* Right actions */}
        <div className="hidden items-center gap-3 md:flex">
          <a
            className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm text-zinc-900 transition hover:bg-zinc-50"
            href={withLang("http://localhost:5173/directory", lang)}
          >
            Directory
          </a>
          <a
            className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-900 px-4 text-sm text-white transition hover:bg-zinc-800"
            href={withLang("http://localhost:5173/welcome", lang)}
          >
            Login
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
                <a
                  className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm text-zinc-900 transition hover:bg-zinc-50"
                  href={withLang("http://localhost:5173/directory", lang)}
                  onClick={() => setOpen(false)}
                >
                  Directory
                </a>
                <a
                  className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-900 px-4 text-sm text-white transition hover:bg-zinc-800"
                  href={withLang("http://localhost:5173/welcome", lang)}
                  onClick={() => setOpen(false)}
                >
                  Login
                </a>
              </div>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
