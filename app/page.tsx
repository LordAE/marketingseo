"use client";

import React, { useEffect, useMemo, useState } from "react";
import Navbar from "./components/Navbar";
import LanguageFooter from "./components/LanguageFooter";
import {
  DEFAULT_LANG,
  resolveInitialLang,
  setLangEverywhere,
  type LangCode,
} from "./lib/lang";

import { auth, db } from "./lib/firebase";
import {
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  type User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

/** ✅ Set your app URL here */
const APP_BASE = "https://app.greenpassgroup.com";
// const APP_BASE = "http://localhost:5173";

/** Always returns: APP_BASE + path + ?lang=<lang> */
function appLink(path: string, lang: string) {
  const cleanPath = (path || "/").startsWith("/") ? path : `/${path}`;
  const code = lang || "en";
  const sep = cleanPath.includes("?") ? "&" : "?";
  return `${APP_BASE}${cleanPath}${sep}lang=${encodeURIComponent(code)}`;
}

type RoleValue = "student" | "agent" | "tutor" | "school";

const ROLE_ITEMS: { value: RoleValue; key: string; def: string }[] = [
  { value: "student", key: "role_student", def: "Student" },
  { value: "agent", key: "role_agent", def: "Agent" },
  { value: "tutor", key: "role_tutor", def: "Tutor" },
  { value: "school", key: "role_school", def: "School" },
];

/** ✅ Minimal translations for auth UI (fallback to EN for missing keys) */
const TX: Record<LangCode, Record<string, string>> = {
  en: {
    // Hero (Option A)
    hero_line1: "Study abroad. Work abroad.",
    hero_line2: "Build your future with GreenPass.",
    hero_sub:
      "GreenPass is your all-in-one platform for international students — connect with verified schools, agents, tutors, jobs, and immigration support in one place.",

    // Feature cards
    card1_title: "Verified Schools",
    card1_sub: "Discover trusted institutions.",
    card2_title: "One App. One Journey.",
    card2_sub: "Study • Work • Immigration support — in one place.",
    card3_title: "Tutors & Agents",
    card3_sub: "Get guided step-by-step.",

    // Auth UI
    signin: "Sign in",
    signup: "Sign up",
    login_title: "Log in",
    signup_title: "Create account",
    google: "Continue with Google",
    apple: "Continue with Apple",
    or: "OR",
    choose_role: "Choose role",
    select_role: "Select a role…",
    email: "Email",
    email_ph: "Email address",
    password: "Password",
    password_ph: "Password",
    confirm: "Confirm password",
    confirm_ph: "Confirm password",
    cta_login: "Log in",
    cta_signup: "Create account",
    have_account: "Have an account?",
    no_account: "Don’t have an account?",
    role_required: "Please select a role.",
    pw_mismatch: "Passwords do not match.",
    weak_pw: "Password must be at least 6 characters.",
    invalid_creds: "Invalid email or password.",
    email_in_use: "Email is already in use.",
    loading: "Please wait…",
  },

  // The languages below match your LanguageFooter options.
  // If a key is missing, it will safely fall back to English.
  vi: {
    hero_line1: "Du học. Làm việc quốc tế.",
    hero_line2: "Xây dựng tương lai cùng GreenPass.",
    hero_sub:
      "GreenPass là nền tảng tất cả-trong-một dành cho du học sinh — kết nối với trường đã xác minh, tư vấn viên, gia sư, việc làm và hỗ trợ di trú tại một nơi.",
    card1_title: "Trường đã xác minh",
    card1_sub: "Khám phá các trường uy tín.",
    card2_title: "Một ứng dụng. Một hành trình.",
    card2_sub: "Học • Làm • Hỗ trợ di trú — trong một nơi.",
    card3_title: "Gia sư & Tư vấn",
    card3_sub: "Được hướng dẫn từng bước.",
  },

  fil: {
    hero_line1: "Mag-aral abroad. Magtrabaho abroad.",
    hero_line2: "Buoin ang future mo with GreenPass.",
    hero_sub:
      "GreenPass ang all-in-one platform para sa international students — kumonekta sa verified schools, agents, tutors, jobs, at immigration support sa iisang lugar.",
    card1_title: "Verified Schools",
    card1_sub: "Hanapin ang trusted institutions.",
    card2_title: "One App. One Journey.",
    card2_sub: "Study • Work • Immigration support — iisang place.",
    card3_title: "Tutors & Agents",
    card3_sub: "Step-by-step na guidance.",
  },

  ceb: {
    hero_line1: "Mag-eskwela sa abroad. Mag-trabaho sa abroad.",
    hero_line2: "Tukora ang imong kaugmaon sa GreenPass.",
    hero_sub:
      "GreenPass kay all-in-one platform para sa international students — konekta sa verified schools, agents, tutors, trabaho, ug immigration support sa usa ka lugar.",
    card1_title: "Verified Schools",
    card1_sub: "Pangitaa ang kasaligan nga mga eskwelahan.",
    card2_title: "One App. One Journey.",
    card2_sub: "Study • Work • Immigration support — sa usa ka lugar.",
    card3_title: "Tutors & Agents",
    card3_sub: "Gi-guide ka step-by-step.",
  },

  es: {
    hero_line1: "Estudia en el extranjero. Trabaja en el extranjero.",
    hero_line2: "Construye tu futuro con GreenPass.",
    hero_sub:
      "GreenPass es tu plataforma todo-en-uno para estudiantes internacionales: conecta con escuelas verificadas, agentes, tutores, empleos y apoyo migratorio en un solo lugar.",
    card1_title: "Escuelas verificadas",
    card1_sub: "Descubre instituciones confiables.",
    card2_title: "Una app. Un camino.",
    card2_sub: "Estudio • Trabajo • Migración — en un solo lugar.",
    card3_title: "Tutores y agentes",
    card3_sub: "Guía paso a paso.",
  },

  ja: {
    hero_line1: "海外で学ぶ。海外で働く。",
    hero_line2: "GreenPassで未来をつくろう。",
    hero_sub:
      "GreenPassは留学生向けのオールインワンプラットフォーム。認証済みの学校、エージェント、講師、仕事、移民サポートを一つに。",
    card1_title: "認証済み学校",
    card1_sub: "信頼できる学校を探す。",
    card2_title: "1つのアプリ。1つの旅。",
    card2_sub: "学ぶ • 働く • 移民サポート — まとめて。",
    card3_title: "講師 & エージェント",
    card3_sub: "ステップごとにサポート。",
  },

  ko: {
    hero_line1: "해외 유학. 해외 취업.",
    hero_line2: "GreenPass로 미래를 준비하세요.",
    hero_sub:
      "GreenPass는 유학생을 위한 올인원 플랫폼입니다 — 검증된 학교, 에이전트, 튜터, 일자리, 이민 지원을 한 곳에서 연결하세요.",
    card1_title: "검증된 학교",
    card1_sub: "신뢰할 수 있는 기관을 찾아보세요.",
    card2_title: "하나의 앱. 하나의 여정.",
    card2_sub: "학업 • 취업 • 이민 지원 — 한 곳에서.",
    card3_title: "튜터 & 에이전트",
    card3_sub: "단계별로 안내합니다.",
  },

  zh: {
    hero_line1: "出国留学。海外工作。",
    hero_line2: "用 GreenPass 规划你的未来。",
    hero_sub:
      "GreenPass 是面向国际学生的一站式平台——在一个地方连接已验证的学校、顾问/中介、导师、工作机会与移民支持。",
    card1_title: "已验证院校",
    card1_sub: "发现可信机构。",
    card2_title: "一个应用，一个旅程。",
    card2_sub: "学习 • 工作 • 移民支持 — 一站式。",
    card3_title: "导师与顾问",
    card3_sub: "一步一步带你走。",
  },

  ar: {
    hero_line1: "ادرس في الخارج. اعمل في الخارج.",
    hero_line2: "ابنِ مستقبلك مع GreenPass.",
    hero_sub:
      "GreenPass منصة متكاملة للطلاب الدوليين — تواصل مع مدارس ووكلاء ومدرّسين وفرص عمل ودعم للهجرة في مكان واحد.",
    card1_title: "مدارس موثّقة",
    card1_sub: "اكتشف مؤسسات موثوقة.",
    card2_title: "تطبيق واحد. رحلة واحدة.",
    card2_sub: "دراسة • عمل • دعم للهجرة — في مكان واحد.",
    card3_title: "مدرّسون ووكلاء",
    card3_sub: "إرشاد خطوة بخطوة.",
  },

  "pt-BR": {
    hero_line1: "Estude no exterior. Trabalhe no exterior.",
    hero_line2: "Construa seu futuro com a GreenPass.",
    hero_sub:
      "A GreenPass é a plataforma tudo-em-um para estudantes internacionais — conecte-se com escolas verificadas, agentes, tutores, vagas e suporte de imigração em um só lugar.",
    card1_title: "Escolas verificadas",
    card1_sub: "Descubra instituições confiáveis.",
    card2_title: "Um app. Uma jornada.",
    card2_sub: "Estudo • Trabalho • Imigração — em um só lugar.",
    card3_title: "Tutores e agentes",
    card3_sub: "Orientação passo a passo.",
  },

  fr: {
    hero_line1: "Étudie à l’étranger. Travaille à l’étranger.",
    hero_line2: "Construis ton avenir avec GreenPass.",
    hero_sub:
      "GreenPass est une plateforme tout-en-un pour les étudiants internationaux — écoles vérifiées, agents, tuteurs, emplois et soutien à l’immigration, au même endroit.",
    card1_title: "Écoles vérifiées",
    card1_sub: "Découvre des institutions fiables.",
    card2_title: "Une app. Un parcours.",
    card2_sub: "Études • Travail • Immigration — au même endroit.",
    card3_title: "Tuteurs & agents",
    card3_sub: "Guidé pas à pas.",
  },

  de: {
    hero_line1: "Im Ausland studieren. Im Ausland arbeiten.",
    hero_line2: "Baue deine Zukunft mit GreenPass.",
    hero_sub:
      "GreenPass ist deine All-in-One-Plattform für internationale Studierende — verbinde dich mit verifizierten Schulen, Agenten, Tutoren, Jobs und Einwanderungs-Support an einem Ort.",
    card1_title: "Verifizierte Schulen",
    card1_sub: "Entdecke vertrauenswürdige Einrichtungen.",
    card2_title: "Eine App. Eine Reise.",
    card2_sub: "Studium • Arbeit • Immigration — an einem Ort.",
    card3_title: "Tutoren & Agenten",
    card3_sub: "Schritt-für-Schritt-Begleitung.",
  },
} as any;

function tr(lang: LangCode, key: string, def?: string) {
  return TX[lang]?.[key] || TX.en[key] || def || key;
}

async function ensureUserDoc(user: User, role?: RoleValue) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email || "",
      full_name: user.displayName || "",
      user_type: role || "student",
      onboarding_completed: false,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
    return { exists: false, data: null as any };
  }

  const data = snap.data();
  const patch: any = { updated_at: serverTimestamp() };

  if (role && !data.user_type) patch.user_type = role;

  // Only patch if needed
  await updateDoc(ref, patch);
  return { exists: true, data };
}

async function routeLikeWelcome(user: User, lang: LangCode, fallbackRole?: RoleValue) {
  const { exists, data } = await ensureUserDoc(user, fallbackRole);

  const userType: RoleValue =
    (data?.user_type as RoleValue) || fallbackRole || "student";

  const onboardingCompleted = Boolean(data?.onboarding_completed);

  if (!exists || !onboardingCompleted) {
    window.location.href = appLink(`/app/onboarding?role=${encodeURIComponent(userType)}`, lang);
  } else {
    window.location.href = `/app/dashboard?lang=${lang}`;
  }
}

export default function Page() {
  const [lang, setLang] = useState<LangCode>(DEFAULT_LANG);
  const t = useMemo(() => {
    return {      signin: tr(lang, "signin"),
      signup: tr(lang, "signup"),
      login_title: tr(lang, "login_title"),
      signup_title: tr(lang, "signup_title"),
      google: tr(lang, "google"),
      apple: tr(lang, "apple"),
      or: tr(lang, "or"),
      choose_role: tr(lang, "choose_role"),
      select_role: tr(lang, "select_role"),
      email: tr(lang, "email"),
      email_ph: tr(lang, "email_ph"),
      password: tr(lang, "password"),
      password_ph: tr(lang, "password_ph"),
      confirm: tr(lang, "confirm"),
      confirm_ph: tr(lang, "confirm_ph"),
      cta_login: tr(lang, "cta_login"),
      cta_signup: tr(lang, "cta_signup"),
      have_account: tr(lang, "have_account"),
      no_account: tr(lang, "no_account"),
      role_required: tr(lang, "role_required"),
      pw_mismatch: tr(lang, "pw_mismatch"),
      weak_pw: tr(lang, "weak_pw"),
      invalid_creds: tr(lang, "invalid_creds"),
      email_in_use: tr(lang, "email_in_use"),
      loading: tr(lang, "loading"),
    };
  }, [lang]);

  // auth UI state
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [role, setRole] = useState<RoleValue | "">("");
  const [roleOpen, setRoleOpen] = useState(false);

  // ✅ Initialize language from URL/storage/browser
  useEffect(() => {
    const initial = resolveInitialLang();
    setLang(initial);
    setLangEverywhere(initial);
  }, []);

  // ✅ If already logged in, route like Welcome
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        routeLikeWelcome(user, lang).catch(() => {});
      }
    });
    return () => unsub();
  }, [lang]);

  const canSubmit = useMemo(() => {
    if (!email || !password) return false;
    if (mode === "signup") {
      if (!role) return false;
      if (password.length < 6) return false;
      if (password !== confirm) return false;
    }
    return true;
  }, [email, password, confirm, role, mode]);

  function scrollToAuth() {
    // Smoothly jump to the auth card on the right
    if (typeof document === "undefined") return;
    document.getElementById("auth-card")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function pickRole(r: RoleValue) {
    setMode("signup");
    setRole(r);
    setRoleOpen(false);
    setMsg(null);
    // Wait a tick so the signup UI renders before scrolling
    setTimeout(scrollToAuth, 50);
  }


  async function handleEmailAuth() {
    setMsg(null);
    try {
      setBusy(true);

      if (mode === "signin") {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        await routeLikeWelcome(cred.user, lang);
        return;
      }

      if (!role) {
        setMsg(t.role_required);
        return;
      }
      if (password !== confirm) {
        setMsg(t.pw_mismatch);
        return;
      }
      if (password.length < 6) {
        setMsg(t.weak_pw);
        return;
      }

      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await ensureUserDoc(cred.user, role as RoleValue);
      await routeLikeWelcome(cred.user, lang, role as RoleValue);
    } catch (e: any) {
      const code = String(e?.code || "");
      if (code.includes("auth/invalid-credential") || code.includes("auth/wrong-password")) {
        setMsg(t.invalid_creds);
      } else if (code.includes("auth/email-already-in-use")) {
        setMsg(t.email_in_use);
      } else if (code.includes("auth/weak-password")) {
        setMsg(t.weak_pw);
      } else {
        setMsg(e?.message || "Something went wrong.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setMsg(null);
    try {
      setBusy(true);
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      await routeLikeWelcome(cred.user, lang, role ? (role as RoleValue) : undefined);
    } catch (e: any) {
      setMsg(e?.message || "Google sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleApple() {
    setMsg(null);
    try {
      setBusy(true);
      const provider = new OAuthProvider("apple.com");
      const cred = await signInWithPopup(auth, provider);
      await routeLikeWelcome(cred.user, lang, role ? (role as RoleValue) : undefined);
    } catch (e: any) {
      setMsg(e?.message || "Apple sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  // Close role dropdown on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest?.("[data-role-dropdown]")) setRoleOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Navbar
        lang={lang}
        onLangChange={(code) => {
          setLang(code);
          setLangEverywhere(code);
        }}
      />

      <main className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
          {/* Left promo (LIGHT) */}
          <section>
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>GreenPass</span>
            </div>

            {/* Headline + Subheadline */}
            <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              <span className="block">The Global Marketplace Connecting</span>
              <span className="block">
                <span className="text-slate-900">
                  Schools, Agents, Tutors &amp; Students
                </span>
              </span>
            </h1>

            <div className="headline-accent-bar mt-4 h-1.5 w-24 rounded-full bg-gradient-to-r from-slate-900 to-slate-500" />

            <p className="mt-4 max-w-2xl text-base leading-7 text-gray-600">
              Study, work, and immigration pathways — connected transparently in one trusted platform.
            </p>

            {/* Hero Section Text */}
            <div className="mt-8 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="text-xl font-extrabold text-gray-900">
                Build Your Global Education &amp; Career Network with GreenPass
              </div>
              <p className="mt-3 text-sm leading-6 text-gray-600">
                GreenPass is a trusted marketplace where schools connect with verified agents, agents support students,
                tutors provide academic guidance, and everyone grows together — transparently and efficiently.
              </p>

              {/* Trust line */}
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-gray-700">
                <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1">
                  ✔ Verified profiles
                </span>
                <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1">
                  ✔ Transparent partnerships
                </span>
                <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1">
                  ✔ No hidden agendas
                </span>
              </div>

              {/* Primary CTA */}
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setMsg(null);
                    setTimeout(scrollToAuth, 50);
                  }}
                  className="rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                >
                  Join GreenPass — Start Connecting Today
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setMsg(null);
                    setTimeout(scrollToAuth, 50);
                  }}
                  className="rounded-2xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50"
                >
                  Sign in
                </button>
              </div>
            </div>

            {/* Join as… cards */}
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 items-stretch">
              {/* School */}
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col h-full">
                <div className="flex-1">
<div className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                  SCHOOL
                </div>
                <div className="mt-3 text-base font-extrabold text-gray-900">Join as a School</div>
                <div className="mt-2 text-sm text-gray-600">
                  Connect with trusted global agents and students
                </div>
                <ul className="mt-4 space-y-2 text-sm text-gray-700">
                  <li className="flex gap-2"><span className="mt-2 h-1 w-1 rounded-full bg-emerald-600" />Reach verified agents worldwide</li>
                  <li className="flex gap-2"><span className="mt-2 h-1 w-1 rounded-full bg-emerald-600" />Manage recruitment transparently</li>
                  <li className="flex gap-2"><span className="mt-2 h-1 w-1 rounded-full bg-emerald-600" />Reduce marketing and admission costs</li>
                </ul>
</div>
                <button
                  type="button"
                  onClick={() => pickRole("school")}
                  className="mt-4 w-full rounded-2xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
                >
                  Join as a School
                </button>
              </div>

              {/* Agent */}
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col h-full">
                <div className="flex-1">
<div className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                  AGENT
                </div>
                <div className="mt-3 text-base font-extrabold text-gray-900">Join as an Agent</div>
                <div className="mt-2 text-sm text-gray-600">
                  Work directly with real schools — no middle layers
                </div>
                <ul className="mt-4 space-y-2 text-sm text-gray-700">
                  <li className="flex gap-2"><span className="mt-2 h-1 w-1 rounded-full bg-emerald-600" />Access verified schools and programs</li>
                  <li className="flex gap-2"><span className="mt-2 h-1 w-1 rounded-full bg-emerald-600" />Track applications clearly</li>
                  <li className="flex gap-2"><span className="mt-2 h-1 w-1 rounded-full bg-emerald-600" />Build long-term, trusted partnerships</li>
                </ul>
</div>
                <button
                  type="button"
                  onClick={() => pickRole("agent")}
                  className="mt-4 w-full rounded-2xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
                >
                  Join as an Agent
                </button>
              </div>

              {/* Tutor */}
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col h-full">
                <div className="flex-1">
<div className="inline-flex items-center rounded-full bg-yellow-50 px-3 py-1 text-xs font-bold text-yellow-800">
                  TUTOR
                </div>
                <div className="mt-3 text-base font-extrabold text-gray-900">Join as a Tutor</div>
                <div className="mt-2 text-sm text-gray-600">
                  Support students globally and grow your practice
                </div>
                <ul className="mt-4 space-y-2 text-sm text-gray-700">
                  <li className="flex gap-2"><span className="mt-2 h-1 w-1 rounded-full bg-emerald-600" />Find students internationally</li>
                  <li className="flex gap-2"><span className="mt-2 h-1 w-1 rounded-full bg-emerald-600" />Offer academic and pathway support</li>
                  <li className="flex gap-2"><span className="mt-2 h-1 w-1 rounded-full bg-emerald-600" />Build your professional profile</li>
                </ul>
</div>
                <button
                  type="button"
                  onClick={() => pickRole("tutor")}
                  className="mt-4 w-full rounded-2xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
                >
                  Join as a Tutor
                </button>
              </div>

              {/* Student */}
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col h-full">
                <div className="flex-1">
<div className="inline-flex items-center rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">
                  STUDENT
                </div>
                <div className="mt-3 text-base font-extrabold text-gray-900">Join as a Student</div>
                <div className="mt-2 text-sm text-gray-600">
                  Find schools, agents, and tutors you can trust
                </div>
                <ul className="mt-4 space-y-2 text-sm text-gray-700">
                  <li className="flex gap-2"><span className="mt-2 h-1 w-1 rounded-full bg-emerald-600" />Discover verified schools and programs</li>
                  <li className="flex gap-2"><span className="mt-2 h-1 w-1 rounded-full bg-emerald-600" />Connect with reliable agents and tutors</li>
                  <li className="flex gap-2"><span className="mt-2 h-1 w-1 rounded-full bg-emerald-600" />Get guided step by step — transparently</li>
                </ul>
</div>
                <button
                  type="button"
                  onClick={() => pickRole("student")}
                  className="mt-4 w-full rounded-2xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
                >
                  Join as a Student
                </button>
              </div>
            </div>

            {/* Closing line */}
            <p className="mt-6 text-sm font-semibold text-gray-700">
              One platform. One journey. Real connections that matter.
            </p>
          </section>

          {/* Right auth card (LIGHT) */}
          <section>
            <div className="mx-auto w-full max-w-md">
              <div id="auth-card" className="rounded-3xl border border-gray-200 bg-white p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-semibold">
                      {mode === "signin" ? t.login_title : t.signup_title}
                    </div>
                    <div className="text-sm text-gray-500">
                      {mode === "signin" ? "Welcome back." : "Sign up to start your journey"}
                    </div>
                  </div>
                  <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-pink-500 to-orange-400" />
                </div>

                {/* Tabs */}
                <div className="mt-5 grid grid-cols-2 rounded-2xl bg-gray-100 p-1">
                  <button
                    onClick={() => setMode("signin")}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                      mode === "signin" ? "bg-white shadow-sm" : "text-gray-600"
                    }`}
                  >
                    {t.signin}
                  </button>
                  <button
                    onClick={() => setMode("signup")}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                      mode === "signup" ? "bg-white shadow-sm" : "text-gray-600"
                    }`}
                  >
                    {t.signup}
                  </button>
                </div>

                {/* Social */}
                <div className="mt-5 space-y-2">
                  <button
                    onClick={handleGoogle}
                    disabled={busy}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm hover:bg-gray-50 disabled:opacity-60"
                  >
                    {t.google}
                  </button>
                  <button
                    onClick={handleApple}
                    disabled={busy}
                    className="w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-black disabled:opacity-60"
                  >
                    {t.apple}
                  </button>
                </div>

                <div className="my-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-200" />
                  <div className="text-xs text-gray-500">{t.or}</div>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                {/* Role dropdown (CUSTOM, fixes hover-only + dark option issues) */}
                {mode === "signup" && (
                  <div className="mb-3" data-role-dropdown>
                    <label className="mb-1 block text-xs font-semibold text-gray-600">
                      {t.choose_role}
                    </label>

                    <button
                      type="button"
                      onClick={() => setRoleOpen((v) => !v)}
                      className="flex w-full items-center justify-between rounded-2xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <span className={role ? "text-gray-900" : "text-gray-400"}>
                        {role
                          ? ROLE_ITEMS.find((x) => x.value === role)?.def
                          : t.select_role}
                      </span>
                      <span className="text-gray-400">▾</span>
                    </button>

                    {roleOpen && (
                      <div className="mt-2 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
                        {ROLE_ITEMS.map((r) => (
                          <button
                            key={r.value}
                            type="button"
                            onClick={() => {
                              setRole(r.value);
                              setRoleOpen(false);
                            }}
                            className={`flex w-full items-center px-3 py-3 text-left text-sm hover:bg-gray-50 ${
                              role === r.value ? "bg-emerald-50 text-emerald-700" : "text-gray-900"
                            }`}
                          >
                            {tr(lang, r.key, r.def)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Email */}
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-600">
                      {t.email}
                    </label>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t.email_ph}
                      className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      autoComplete="email"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-600">
                      {t.password}
                    </label>
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t.password_ph}
                      type="password"
                      className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    />
                  </div>

                  {mode === "signup" && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-600">
                        {t.confirm}
                      </label>
                      <input
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder={t.confirm_ph}
                        type="password"
                        className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        autoComplete="new-password"
                      />
                    </div>
                  )}
                </div>

                {msg && (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {msg}
                  </div>
                )}

                <button
                  onClick={handleEmailAuth}
                  disabled={!canSubmit || busy}
                  className="mt-5 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
                >
                  {busy ? t.loading : mode === "signin" ? t.cta_login : t.cta_signup}
                </button>

                <p className="mt-4 text-center text-xs text-gray-500">
                  After login, you will continue inside the GreenPass app.
                </p>
              </div>

              <div className="mt-4 rounded-3xl border border-gray-200 bg-white p-4 text-center text-sm text-gray-700 shadow-sm">
                {mode === "signin" ? (
                  <>
                    {t.no_account}{" "}
                    <button
                      onClick={() => setMode("signup")}
                      className="font-semibold text-blue-600 hover:underline"
                    >
                      {t.signup}
                    </button>
                  </>
                ) : (
                  <>
                    {t.have_account}{" "}
                    <button
                      onClick={() => setMode("signin")}
                      className="font-semibold text-blue-600 hover:underline"
                    >
                      {t.signin}
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>

        <div className="mt-10">
          <LanguageFooter
            value={lang}
            onChange={(code) => {
              setLang(code);
              setLangEverywhere(code);
            }}
          />      
        </div>
      </main>
    </div>
  );
}
