"use client";

import React from "react";

// ✅ CHANGE THESE IMPORTS IF YOUR FOLDER IS DIFFERENT
import Navbar from "./components/Navbar";
import LanguageFooter from "./components/LanguageFooter";

type LangCode =
  | "en"
  | "fil"
  | "ceb"
  | "es"
  | "fr"
  | "de"
  | "pt-BR"
  | "ar"
  | "zh"
  | "ja"
  | "ko";

const DEFAULT_LANG: LangCode = "en";

function normalizeLang(input: string): LangCode {
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

function getLangFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return new URL(window.location.href).searchParams.get("lang");
  } catch {
    return null;
  }
}

function getStoredLang(): string | null {
  if (typeof window === "undefined") return null;
  return (
    window.localStorage.getItem("gp_lang") ||
    window.localStorage.getItem("i18nextLng")
  );
}

function getBrowserLang(): string | null {
  if (typeof window === "undefined") return null;
  return window.navigator.language || window.navigator.languages?.[0] || null;
}

function setLangEverywhere(code: string) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem("gp_lang", code);
  window.localStorage.setItem("i18nextLng", code);
  document.documentElement.lang = code;

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
 * ✅ Safer: supports absolute + relative URLs.
 * - If url is relative like "/welcome", it will use window.location.origin as base.
 */
function withLang(url: string, lang: string) {
  if (typeof window === "undefined") return url;

  try {
    const u = new URL(url, window.location.origin);
    u.searchParams.set("lang", lang || "en");
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Lightweight landing translations (edit as you want)
 */
const T = {
  en: {
    brand_tagline: "Study • Work • Immigration Support",
    hero_title: "The all-in-one platform for international students.",
    hero_subtitle:
      "Find schools, agents, tutors, and events — and manage your journey inside the GreenPass Marketplace.",
    cta_login: "Login to App",
    cta_directory: "Explore Directory",
    cta_events: "View Events",
    note_dns:
      "Later, we’ll switch these links to app.greenpassgroup.com when you’re ready to update DNS.",

    features: "Features",
    services: "Services",
    how: "How it works",
    contact: "Contact",

    features_p:
      "A single platform to discover schools, compare programs, talk to verified agents, book tutors, and track your immigration journey.",
    services_p:
      "Designed for international students — from choosing a school to settling in and planning your pathway.",
    how_p1: "Browse schools, programs, agents, tutors, and events.",
    how_p2: "Message providers and get guided next steps.",
    how_p3: "Keep your documents and milestones organized.",
    contact_p:
      "Want to partner as a school, agent, or tutor? Reach out and we’ll get you onboarded.",

    open_app: "Open GreenPass App",
    email_us: "Email us",
    step: "STEP",
    s1: "Explore",
    s2: "Connect",
    s3: "Track",
  },

  fil: {
    brand_tagline: "Pag-aaral • Trabaho • Suporta sa Imigrasyon",
    hero_title: "All-in-one platform para sa international students.",
    hero_subtitle:
      "Maghanap ng schools, agents, tutors, at events — at i-manage ang journey mo sa GreenPass app.",
    cta_login: "Mag-login sa App",
    cta_directory: "Tingnan ang Directory",
    cta_events: "Tingnan ang Events",
    note_dns:
      "Sa susunod, ililipat natin ang links sa app.greenpassgroup.com kapag handa ka nang i-update ang DNS.",

    features: "Mga Feature",
    services: "Mga Serbisyo",
    how: "Paano gumagana",
    contact: "Kontak",

    features_p:
      "Isang platform para maghanap ng schools, mag-compare ng programs, makipag-usap sa verified agents, mag-book ng tutors, at ma-track ang immigration journey.",
    services_p:
      "Para sa international students — mula pagpili ng school hanggang pag-settle at pagplano ng pathway.",
    how_p1: "Mag-browse ng schools, programs, agents, tutors, at events.",
    how_p2: "Mag-message at kumuha ng guided next steps.",
    how_p3: "Ayusin ang documents at milestones mo.",
    contact_p:
      "Gustong makipag-partner bilang school, agent, o tutor? Mag-message at i-onboard ka namin.",

    open_app: "Buksan ang GreenPass App",
    email_us: "I-email kami",
    step: "HAKBANG",
    s1: "Maghanap",
    s2: "Kumonekta",
    s3: "I-track",
  },

  ceb: {
    brand_tagline: "Tuon • Trabaho • Suporta sa Imigrasyon",
    hero_title: "All-in-one platform para sa international students.",
    hero_subtitle:
      "Pangitaa ang schools, agents, tutors, ug events — ug i-manage imong journey sulod sa GreenPass app.",
    cta_login: "Mo-login sa App",
    cta_directory: "Tan-awa ang Directory",
    cta_events: "Tan-awa ang Events",
    note_dns:
      "Sunod, ilisan nato ang links ngadto sa app.greenpassgroup.com kung ready na ka mo-update sa DNS.",

    features: "Mga Feature",
    services: "Mga Serbisyo",
    how: "Unsaon pag gamit",
    contact: "Kontak",

    features_p:
      "Usa ka platform para mangita og schools, ikumpara ang programs, makig-istorya sa verified agents, mag-book og tutors, ug masubay ang immigration journey.",
    services_p:
      "Alang sa international students — gikan sa pagpili og school hangtod sa pag-settle ug pagplano sa pathway.",
    how_p1: "Tan-awa ang schools, programs, agents, tutors, ug events.",
    how_p2: "Mag-message ug kuhaa ang guided next steps.",
    how_p3: "Organisaha imong documents ug milestones.",
    contact_p:
      "Gusto makig-partner isip school, agent, o tutor? Reach out ug i-onboard tika namo.",

    open_app: "Ablihi ang GreenPass App",
    email_us: "Email namo",
    step: "LAKANG",
    s1: "Susiha",
    s2: "Konektar",
    s3: "Subaya",
  },

  es: {
    brand_tagline: "Estudio • Trabajo • Apoyo Migratorio",
    hero_title: "La plataforma todo-en-uno para estudiantes internacionales.",
    hero_subtitle:
      "Encuentra escuelas, agentes, tutores y eventos — y gestiona tu camino dentro de GreenPass.",
    cta_login: "Iniciar sesión",
    cta_directory: "Explorar directorio",
    cta_events: "Ver eventos",
    note_dns:
      "Luego cambiaremos estos enlaces a app.greenpassgroup.com cuando estés listo para actualizar el DNS.",

    features: "Funciones",
    services: "Servicios",
    how: "Cómo funciona",
    contact: "Contacto",

    features_p:
      "Una sola plataforma para descubrir escuelas, comparar programas, hablar con agentes verificados, reservar tutores y seguir tu proceso migratorio.",
    services_p:
      "Diseñado para estudiantes internacionales — desde elegir una escuela hasta planificar tu camino.",
    how_p1: "Explora escuelas, programas, agentes, tutores y eventos.",
    how_p2: "Escribe mensajes y recibe los siguientes pasos.",
    how_p3: "Organiza tus documentos y metas.",
    contact_p:
      "¿Quieres asociarte como escuela, agente o tutor? Escríbenos y te ayudamos a comenzar.",

    open_app: "Abrir GreenPass App",
    email_us: "Envíanos un email",
    step: "PASO",
    s1: "Explorar",
    s2: "Conectar",
    s3: "Seguir",
  },

  // ✅ Empty objects are fine; we fallback to EN via Proxy
  fr: {},
  de: {},
  "pt-BR": {},
  ar: {},
  zh: {},
  ja: {},
  ko: {},
} satisfies Record<LangCode, Record<string, string>>;

function getT(lang: LangCode) {
  const base = T[lang] || {};
  return new Proxy(base, {
    // ✅ prop can be string | symbol
    get(target, prop) {
      if (typeof prop !== "string") return undefined;
      return (target as any)[prop] ?? (T.en as any)[prop] ?? "";
    },
  }) as Record<string, string>;
}

export default function Home() {
  const [lang, setLang] = React.useState<LangCode>(DEFAULT_LANG);

  React.useEffect(() => {
    const fromUrl = getLangFromUrl();
    const fromStore = getStoredLang();
    const fromBrowser = getBrowserLang();

    const resolved = normalizeLang(fromUrl || fromStore || fromBrowser || "en");
    setLang(resolved);
    setLangEverywhere(resolved);
  }, []);

  const t = React.useMemo(() => getT(lang), [lang]);

  const handleLangChange = (code: string) => {
    const normalized = normalizeLang(code);
    setLang(normalized);
    setLangEverywhere(normalized);
  };

  return (
    <div id="top" className="min-h-screen bg-white text-zinc-900 flex flex-col">
      <Navbar lang={lang} t={t} />

      <div className="flex-1">
        <main className="mx-auto max-w-5xl px-6 py-20">
          <div className="mb-10 flex items-center justify-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold">
              GP
            </div>
            <div>
              <div className="text-lg font-semibold leading-tight">GreenPass</div>
              <div className="text-sm text-zinc-600">{t.brand_tagline}</div>
            </div>
          </div>

          <div className="w-full text-center">
            <h1 className="mx-auto max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              {t.hero_title}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-zinc-600">
              {t.hero_subtitle}
            </p>

            <div className="mt-10 flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <a
                className="flex h-12 w-full max-w-xs items-center justify-center rounded-full bg-zinc-900 px-6 text-white transition hover:bg-zinc-800"
                href={withLang("/welcome", lang)}
              >
                {t.cta_login}
              </a>

              <a
                className="flex h-12 w-full max-w-xs items-center justify-center rounded-full border border-zinc-200 bg-white px-6 text-zinc-900 transition hover:bg-zinc-50"
                href={withLang("/directory", lang)}
              >
                {t.cta_directory}
              </a>

              <a
                className="flex h-12 w-full max-w-xs items-center justify-center rounded-full border border-zinc-200 bg-white px-6 text-zinc-900 transition hover:bg-zinc-50"
                href={withLang("/events", lang)}
              >
                {t.cta_events}
              </a>
            </div>

            <p className="mt-6 text-sm text-zinc-500">{t.note_dns}</p>
          </div>
        </main>

        <section id="features" className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">{t.features}</h2>
          <p className="mt-3 max-w-3xl text-zinc-600">{t.features_p}</p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              { tt: "Verified Directory", d: "Schools, programs, agents, tutors — curated and searchable." },
              { tt: "Messaging & Leads", d: "Chat with providers and keep all conversations in one place." },
              { tt: "Events", d: "Join fairs and webinars, reserve a slot, and get reminders." },
              { tt: "Document System", d: "Upload, organize, and share documents securely when needed." },
            ].map((c) => (
              <div key={c.tt} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="text-sm font-semibold text-zinc-900">{c.tt}</div>
                <div className="mt-2 text-sm text-zinc-600">{c.d}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="services" className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">{t.services}</h2>
          <p className="mt-3 max-w-3xl text-zinc-600">{t.services_p}</p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              "School & program matching",
              "Agent referrals & visa support",
              "IELTS/TOEFL tutoring",
              "Housing, banking, insurance guidance",
            ].map((x) => (
              <div key={x} className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="text-sm font-medium text-zinc-900">{x}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">{t.how}</h2>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { n: "1", title: t.s1, desc: t.how_p1 },
              { n: "2", title: t.s2, desc: t.how_p2 },
              { n: "3", title: t.s3, desc: t.how_p3 },
            ].map((s) => (
              <div key={s.n} className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="text-xs font-semibold text-emerald-700">
                  {t.step} {s.n}
                </div>
                <div className="mt-2 text-sm font-semibold text-zinc-900">{s.title}</div>
                <div className="mt-2 text-sm text-zinc-600">{s.desc}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="contact" className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">{t.contact}</h2>
          <p className="mt-3 max-w-3xl text-zinc-600">{t.contact_p}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-900 px-6 text-white transition hover:bg-zinc-800"
              href={withLang("/welcome", lang)}
            >
              {t.open_app}
            </a>
            <a
              className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-200 bg-white px-6 text-zinc-900 transition hover:bg-zinc-50"
              href="mailto:info@greenpassimmigration.com"
            >
              {t.email_us}
            </a>
          </div>
        </section>
      </div>

      <LanguageFooter value={lang} onChange={handleLangChange} />
    </div>
  );
}
