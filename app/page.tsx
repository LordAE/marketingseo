"use client";

import React from "react";
import Navbar from "./components/Navbar";
import LanguageFooter from "./components/LanguageFooter";
import {
  DEFAULT_LANG,
  resolveInitialLang,
  setLangEverywhere,
  type LangCode,
} from "./lib/lang";

/**
 * ✅ Marketing SEO language setup (Facebook-like)
 * - Auto-detect language: URL (?lang) → localStorage → browser locale → default en
 * - Persists language: localStorage gp_lang + i18nextLng
 * - Updates <html lang="..."> and RTL when needed
 * - Keeps URL lang in sync (no reload)
 * - All outbound links to app.greenpassgroup.com include ?lang=<selected>
 */

const APP_BASE = "https://app.greenpassgroup.com";
//const APP_BASE = "http://localhost:5173";


/**
 * ✅ Hydration-safe absolute URL builder (NO window, NO URL())
 * Always returns: https://app.greenpassgroup.com/<path>?lang=<lang>
 */
function appLink(path: string, lang: string) {
  const cleanPath = (path || "/").startsWith("/") ? path : `/${path}`;
  const code = lang || "en";
  const sep = cleanPath.includes("?") ? "&" : "?";
  return `${APP_BASE}${cleanPath}${sep}lang=${encodeURIComponent(code)}`;
}

const T: Record<LangCode, Record<string, string>> = {
  en: {
    brand_tagline: "Study • Work • Immigration Support",
    hero_title: "The all-in-one platform for international students.",
    hero_subtitle:
      "Find schools, agents, tutors, and events — and manage your journey inside the GreenPass Marketplace.",
    cta_login: "Login to App",
    cta_directory: "Explore Directory",
    cta_events: "View Events",
    note_dns: "Links will open in app.greenpassgroup.com with your selected language.",

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

  vi: {
    brand_tagline: "Học tập • Việc làm • Hỗ trợ Di trú",
    hero_title: "Nền tảng tất cả-trong-một cho du học sinh.",
    hero_subtitle:
      "Tìm trường, tư vấn viên, gia sư và sự kiện — và quản lý hành trình của bạn trong GreenPass Marketplace.",
    cta_login: "Đăng nhập vào Ứng dụng",
    cta_directory: "Khám phá Danh bạ",
    cta_events: "Xem Sự kiện",
    note_dns:
      "Liên kết sẽ mở trên app.greenpassgroup.com với ngôn ngữ bạn đã chọn.",

    features: "Tính năng",
    services: "Dịch vụ",
    how: "Cách hoạt động",
    contact: "Liên hệ",

    features_p:
      "Một nền tảng duy nhất để khám phá trường học, so sánh chương trình, trò chuyện với tư vấn viên đã xác minh, đặt lịch gia sư và theo dõi lộ trình di trú của bạn.",
    services_p:
      "Thiết kế cho du học sinh — từ chọn trường đến ổn định cuộc sống và lập kế hoạch lộ trình.",
    how_p1: "Duyệt trường, chương trình, tư vấn viên, gia sư và sự kiện.",
    how_p2: "Nhắn tin với nhà cung cấp và nhận hướng dẫn bước tiếp theo.",
    how_p3: "Sắp xếp tài liệu và cột mốc của bạn gọn gàng.",
    contact_p:
      "Muốn hợp tác với vai trò trường học, tư vấn viên hoặc gia sư? Hãy liên hệ để chúng tôi hỗ trợ onboard.",

    open_app: "Mở Ứng dụng GreenPass",
    email_us: "Gửi email",
    step: "BƯỚC",
    s1: "Khám phá",
    s2: "Kết nối",
    s3: "Theo dõi",
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
      "Bubukas ang links sa app.greenpassgroup.com gamit ang napili mong language.",

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
      "Mo-open ang links sa app.greenpassgroup.com gamit ang napili nimo nga language.",

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
      "Los enlaces se abrirán en app.greenpassgroup.com con tu idioma seleccionado.",

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

  fr: {} as any,
  de: {} as any,
  "pt-BR": {} as any,
  ar: {} as any,
  zh: {} as any,
  ja: {} as any,
  ko: {} as any,
};

function getT(lang: LangCode) {
  // fallback to English for missing keys
  return new Proxy(T[lang] || {}, {
    get(target, prop: string | symbol) {
      if (typeof prop !== "string") return "";
      return (target as any)[prop] ?? (T.en as any)[prop] ?? "";
    },
  }) as Record<string, string>;
}

export default function Home() {
  const [lang, setLang] = React.useState<LangCode>(DEFAULT_LANG);

  React.useEffect(() => {
    const resolved = resolveInitialLang();
    setLang(resolved);
    setLangEverywhere(resolved);
  }, []);

  const t = React.useMemo(() => getT(lang), [lang]);

  const handleLangChange = (code: LangCode) => {
    setLang(code);
    setLangEverywhere(code);
  };

  return (
    <div id="top" className="min-h-screen bg-white text-zinc-900 flex flex-col">
      {/* Navbar */}
      <Navbar lang={lang} t={t} />


{/* Page content */}
<div className="flex-1">
  {/* HERO */}
  <section
    className="relative overflow-hidden"
    style={{
      backgroundImage:
        "linear-gradient(rgba(15,23,42,1), rgba(15,23,42,0.15)), url('/img/Gradient.png')",
      backgroundSize: "cover",
      backgroundPosition: "center",
    }}
  >
    <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(1200px_600px_at_50%_-10%,rgba(16,185,129,0.35),transparent_60%)]" />
    <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-4xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm text-white/90 backdrop-blur">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span>{t.brand_tagline}</span>
        </div>

        <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
          {t.hero_title}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/85">
          {t.hero_subtitle}
        </p>

        {/* CTAs */}
        <div className="mt-10 flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <a
            className="flex h-12 w-full max-w-xs items-center justify-center rounded-full bg-emerald-500 px-6 font-semibold text-white shadow-sm transition hover:bg-emerald-600"
            href={appLink("/welcome", lang)}
          >
            {t.cta_login}
          </a>

          <a
            className="flex h-12 w-full max-w-xs items-center justify-center rounded-full border border-white/30 bg-white/10 px-6 font-semibold text-white backdrop-blur transition hover:bg-white/15"
            href={appLink("/directory", lang)}
          >
            {t.cta_directory}
          </a>

          <a
            className="flex h-12 w-full max-w-xs items-center justify-center rounded-full border border-white/30 bg-white/10 px-6 font-semibold text-white backdrop-blur transition hover:bg-white/15"
            href={appLink("/events", lang)}
          >
            {t.cta_events}
          </a>
        </div>

        <p className="mt-6 text-sm text-white/70">{t.note_dns}</p>
      </div>

      {/* FEATURE TILES (reference-style) */}
      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            title: "Future Students",
            desc: "Explore programs, admissions, and support designed for international students.",
            href: appLink("/directory", lang),
          },
          {
            title: "Academic Programs",
            desc: "Compare tuition, duration, and intake dates — all in one place.",
            href: appLink("/directory", lang),
          },
          {
            title: "Events & Key Dates",
            desc: "Join fairs, webinars, and school events — reserve slots and get reminders.",
            href: appLink("/events", lang),
          },
          {
            title: "Verified Providers",
            desc: "Agents, tutors, and schools can submit verification documents for review.",
            href: appLink("/welcome", lang),
          },
        ].map((x) => (
          <a
            key={x.title}
            href={x.href}
            // className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/15 bg-white/10 p-6 text-left text-white shadow-sm backdrop-blur transition hover:bg-white/15"
            // Fix the text being negligible
            className="group relative flex h-full flex-col overflow-hidden rounded-3xl
            border border-white/20 bg-black/30 p-6 text-left text-white
            shadow-sm backdrop-blur-md transition hover:bg-black/40"
          >
            <div className="text-sm font-semibold tracking-wide text-white/90">
              {x.title}
            </div>

            <div className="mt-2 text-sm leading-6 text-white/80">
              {x.desc}
            </div>

            {/* Push this to the bottom */}
            <div className="mt-auto pt-5 inline-flex items-center gap-2 text-sm font-semibold text-white">
              Learn more{" "}
              <span className="transition group-hover:translate-x-0.5">→</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  </section>

  {/* TRUST / STATS */}
  <section className="bg-white">
    <div className="mx-auto max-w-7xl px-6 py-14">
      <div className="grid gap-6 sm:grid-cols-4">
        {[
          { k: "Verified onboarding", v: "KYC + docs per role" },
          { k: "Multi-role marketplace", v: "Student • Agent • Tutor • School" },
          { k: "Messaging built-in", v: "Leads + follow-ups" },
          { k: "Events + directory", v: "Discover & convert" },
        ].map((s) => (
          <div key={s.k} className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold text-zinc-900">{s.k}</div>
            <div className="mt-2 text-sm text-zinc-600">{s.v}</div>
          </div>
        ))}
      </div>
    </div>
  </section>

  {/* Sections */}
  <section id="features" className="mx-auto max-w-7xl px-6 py-16">
    <div className="mx-auto max-w-3xl text-center">
      <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
        {t.features}
      </h2>
      <p className="mt-4 text-lg text-zinc-600">{t.features_p}</p>
    </div>

    <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {[
        {
          tt: "Verified Directory",
          d: "Schools, programs, agents, tutors — curated and searchable.",
        },
        {
          tt: "Messaging & Leads",
          d: "Chat with providers and keep all conversations in one place.",
        },
        {
          tt: "Events",
          d: "Join fairs and webinars, reserve a slot, and get reminders.",
        },
        {
          tt: "Document System",
          d: "Upload and organize verification documents for faster reviews.",
        },
      ].map((c) => (
        <div key={c.tt} className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm transition hover:shadow-md">
          <div className="text-sm font-semibold text-zinc-900">{c.tt}</div>
          <div className="mt-2 text-sm leading-6 text-zinc-600">{c.d}</div>
        </div>
      ))}
    </div>
  </section>

  <section id="services" className="mx-auto max-w-7xl px-6 py-16">
    <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
          {t.services}
        </h2>
        <p className="mt-4 text-lg text-zinc-600">{t.services_p}</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {[
            "School & program matching",
            "Agent referrals & visa support",
            "IELTS/TOEFL tutoring",
            "Housing, banking, insurance guidance",
          ].map((x) => (
            <div key={x} className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="text-center text-sm font-semibold text-zinc-900">{x}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Role cards */}
      <div className="rounded-3xl border border-zinc-200 bg-gradient-to-br from-emerald-50 to-white p-7 shadow-sm">
        <div className="text-sm font-semibold text-emerald-800">Built for every role</div>
        <div className="mt-2 text-sm text-zinc-600">
          GreenPass works like a marketplace: students discover, providers connect, admin verifies.
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {[
            { role: "Student", line: "Browse + chat, upload basic valid ID." },
            { role: "Agent", line: "Valid ID + business permit verification." },
            { role: "Tutor", line: "Valid ID + proof as a tutor." },
            { role: "School", line: "DLI / permits & accreditation docs." },
          ].map((r) => (
            <div key={r.role} className="rounded-2xl border border-emerald-100 bg-white p-5">
              <div className="text-sm font-semibold text-zinc-900">{r.role}</div>
              <div className="mt-1 text-sm text-zinc-600">{r.line}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a
            className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700"
            href={appLink("/welcome", lang)}
          >
            {t.open_app}
          </a>
          <a
            className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
            href={appLink("/directory", lang)}
          >
            {t.cta_directory}
          </a>
        </div>
      </div>
    </div>
  </section>

  <section id="how" className="mx-auto max-w-7xl px-6 py-16">
    <div className="mx-auto max-w-3xl text-center">
      <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">{t.how}</h2>
    </div>

    <div className="mt-10 grid gap-5 sm:grid-cols-3">
      {[
        { n: "1", title: t.s1, desc: t.how_p1 },
        { n: "2", title: t.s2, desc: t.how_p2 },
        { n: "3", title: t.s3, desc: t.how_p3 },
      ].map((s) => (
        <div
          key={s.n}
          className="rounded-3xl border border-zinc-200 bg-white p-10 py-16 text-center shadow-sm"
        >
          <div className="text-sm font-semibold text-emerald-700">
            {t.step} {s.n}
          </div>
          <div className="mt-2 text-2xl font-bold text-zinc-900">{s.title}</div>
          <div className="mt-3 text-sm leading-6 text-zinc-600">{s.desc}</div>
        </div>
      ))}
    </div>
  </section>

  <section className="mx-auto max-w-7xl px-6 py-8">
    <hr />
  </section>

  <section id="contact" className="mx-auto max-w-7xl px-6 py-16">
    <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">{t.contact}</h2>
        <p className="mt-4 text-lg text-zinc-600">{t.contact_p}</p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-900 px-6 font-semibold text-white transition hover:bg-zinc-800"
            href={appLink("/welcome", lang)}
          >
            {t.open_app}
          </a>
          <a
            className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-200 bg-white px-6 font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-50"
            href="mailto:info@greenpassimmigration.com"
          >
            {t.email_us}
          </a>
        </div>
      </div>

      {/* Simple partner logos (reference-inspired) */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
        <div className="text-sm font-semibold text-zinc-900">Trusted by learners worldwide</div>
        <div className="mt-4 grid grid-cols-3 gap-4">
          {[
            { n: "UWE Bristol", src: "https://firebasestorage.googleapis.com/v0/b/greenpass-dc92d.firebasestorage.app/o/home%2Flogos%2FUWEBristol.jpg?alt=media" },
            { n: "Cape Breton", src: "https://firebasestorage.googleapis.com/v0/b/greenpass-dc92d.firebasestorage.app/o/home%2Flogos%2FCapeBretonUniveristy.jpg?alt=media" },
            { n: "U of T", src: "https://firebasestorage.googleapis.com/v0/b/greenpass-dc92d.firebasestorage.app/o/home%2Flogos%2FUniversityofToronto.avif?alt=media" },
            { n: "McGill", src: "https://firebasestorage.googleapis.com/v0/b/greenpass-dc92d.firebasestorage.app/o/home%2Flogos%2FmcgillUniversity.png?alt=media" },
            { n: "UBC", src: "https://firebasestorage.googleapis.com/v0/b/greenpass-dc92d.firebasestorage.app/o/home%2Flogos%2FUniversityofBristishColumbia.jpg?alt=media" },
            { n: "Western", src: "https://firebasestorage.googleapis.com/v0/b/greenpass-dc92d.firebasestorage.app/o/home%2Flogos%2FWesternUniversity.png?alt=media" },
          ].map((p) => (
            <div key={p.n} className="flex items-center justify-center rounded-2xl border border-zinc-100 bg-zinc-50 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} alt={p.n} className="h-10 w-auto object-contain" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
</div>
      <LanguageFooter value={lang} onChange={handleLangChange} />
    </div>
  );
}
