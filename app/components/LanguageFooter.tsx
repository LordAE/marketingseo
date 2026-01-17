"use client";

type Props = {
  value: string;
  onChange: (code: string) => void;
};

const LANGS = [
  { code: "en", label: "English (US)" },
  { code: "fil", label: "Filipino" },
  { code: "ceb", label: "Bisaya" },
  { code: "es", label: "Español" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "zh", label: "中文(简体)" },
  { code: "ar", label: "العربية" },
  { code: "pt-BR", label: "Português (Brasil)" },
  { code: "fr", label: "Français (France)" },
  { code: "de", label: "Deutsch" },
];

export default function LanguageFooter({ value, onChange }: Props) {
  function choose(code: string) {
    onChange(code);
    localStorage.setItem("gp_lang", code);
    localStorage.setItem("i18nextLng", code);
  }

  return (
    <footer className="w-full border-t bg-white">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-gray-600">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => choose(l.code)}
              className={`hover:underline ${
                value === l.code ? "font-semibold text-gray-900" : ""
              }`}
              type="button"
            >
              {l.label}
            </button>
          ))}
          <span className="mx-2 text-gray-300">|</span>
          <button
            type="button"
            className="rounded border px-2 py-0.5 text-gray-700 hover:bg-gray-50"
            onClick={() => alert("Add more languages later")}
          >
            +
          </button>
        </div>
      </div>
    </footer>
  );
}
