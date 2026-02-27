"use client";

import { useSearchParams } from "next/navigation";
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
 sendPasswordResetEmail,
 signInWithEmailAndPassword,
 signInWithPopup,
 type User,
 signOut,
} from "firebase/auth";
import {
 doc,
 getDoc,
 serverTimestamp,
 setDoc,
 updateDoc,
} from "firebase/firestore";

// NOTE: This project doesn't currently have `lucide-react` installed.
// To avoid adding a new dependency, we use lightweight inline SVG icons.
function EyeIcon(props: React.SVGProps<SVGSVGElement>) {
 return (
  <svg
   viewBox="0 0 24 24"
   fill="none"
   xmlns="http://www.w3.org/2000/svg"
   aria-hidden="true"
   {...props}
  >
   <path
    d="M2.25 12s3.5-7.5 9.75-7.5S21.75 12 21.75 12s-3.5 7.5-9.75 7.5S2.25 12 2.25 12Z"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
   />
   <path
    d="M12 15.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
   />
  </svg>
 );
}

function EyeOffIcon(props: React.SVGProps<SVGSVGElement>) {
 return (
  <svg
   viewBox="0 0 24 24"
   fill="none"
   xmlns="http://www.w3.org/2000/svg"
   aria-hidden="true"
   {...props}
  >
   <path
    d="M9.88 9.88A3.25 3.25 0 0 0 14.12 14.12"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
   />
   <path
    d="M10.73 5.08A10.23 10.23 0 0 1 12 4.5c6.25 0 9.75 7.5 9.75 7.5a18.6 18.6 0 0 1-3.09 4.42"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
   />
   <path
    d="M6.23 6.23A18.6 18.6 0 0 0 2.25 12s3.5 7.5 9.75 7.5c1.33 0 2.56-.19 3.68-.53"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
   />
   <path
    d="M2.25 2.25 21.75 21.75"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
   />
  </svg>
 );
}

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

/**
 * ✅ Safe internal `next` param only (prevents open redirects)
 * Allows only paths like "/accept-org-invite?..." and blocks full URLs.
 */
function safeNextPath(p: string) {
 const raw = (p || "").trim();
 if (!raw) return "";
 if (!raw.startsWith("/")) return "";
 if (raw.startsWith("//")) return "";
 const lower = raw.toLowerCase();
 if (lower.includes("http://") || lower.includes("https://")) return "";
 return raw;
}

/** ✅ Firebase Functions base URL (for SEO -> App auth bridge)
 *  Set NEXT_PUBLIC_FUNCTIONS_BASE in your SEO environment (recommended).
 *  Example: https://us-central1-greenpass-dc92d.cloudfunctions.net
 */
const FUNCTIONS_BASE =
 (process.env.NEXT_PUBLIC_FUNCTIONS_BASE as string | undefined) ||
 "https://us-central1-greenpass-dc92d.cloudfunctions.net";

/** Create a one-time auth bridge code (server validates ID token) */
async function createBridgeCode(user: User) {
 const idToken = await user.getIdToken(true);

 const r = await fetch(
  `${FUNCTIONS_BASE.replace(/\/+$/, "")}/createAuthBridgeCode`,
  {
   method: "POST",
   headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${idToken}`,
   },
  }
 );

 if (!r.ok) {
  const msg = await r.text().catch(() => "");
  throw new Error(msg || "Failed to create auth bridge code");
 }

 const data = await r.json().catch(() => ({} as any));
 if (!data?.code) throw new Error("No bridge code returned");
 return data.code as string;
}

/** Accept an invite (sets role & onboarding fields server-side). */
async function acceptInvite(user: User, inviteId: string, token: string) {
 const idToken = await user.getIdToken(true);

 const r = await fetch(
  `${FUNCTIONS_BASE.replace(/\/+$/, "")}/acceptInvite`,
  {
   method: "POST",
   headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${idToken}`,
   },
   body: JSON.stringify({ inviteId, token }),
  }
 );

 if (!r.ok) {
  const msg = await r.text().catch(() => "");
  throw new Error(msg || "Failed to accept invite");
 }

 return r.json().catch(() => ({} as any));
}

type RoleValue = "student" | "agent" | "tutor" | "school";

const ROLE_ITEMS: { value: RoleValue; key: string; def: string }[] = [
 { value: "student", key: "role_student", def: "Student" },
 { value: "agent", key: "role_agent", def: "Agent" },
 { value: "tutor", key: "role_tutor", def: "Tutor" },
 { value: "school", key: "role_school", def: "School" },
];

/** ✅ Minimal translations for auth UI (fallback to EN for missing keys)
 *  NOTE: typed as Record<string,...> so it won't TypeScript-error
 *  if your LangCode union is narrower than the languages you show.
 */
const TX: Record<string, Record<string, string>> = {
 en: {
  // Hero (Option A)
  hero_line1: "Study abroad. Work abroad.",
  hero_line2: "Build your future with GreenPass.",
  hero_sub:
   "GreenPass is your all-in-one platform for international students. Connect with verified schools, agents, tutors, jobs, and immigration support in one place.",

  hero_h1_1: "The Global Marketplace Connecting",
  hero_h1_2: "Schools, Agents, Tutors & Students",
  hero_tagline:
   "Study, work, and immigration pathways. Connected transparently in one trusted platform.",
  promo_title: "Build Your Global Education & Career Network with GreenPass",
  promo_body:
   "GreenPass is a trusted marketplace where schools connect with verified agents, agents support students, tutors provide academic guidance, and everyone grows together transparently and efficiently.",
  trust_verified: "✔ Verified profiles",
  trust_transparent: "✔ Transparent partnerships",
  trust_no_hidden: "✔ No hidden agendas",
  promo_cta_join: "Join GreenPass. Start Connecting Today",
  promo_cta_signin: "Sign in",

  // Feature cards
  card1_title: "Verified Schools",
  card1_sub: "Discover trusted institutions.",
  card2_title: "One App. One Journey.",
  card2_sub: "Study • Work • Immigration support in one place.",
  card3_title: "Tutors & Agents",
  card3_sub: "Get guided step-by-step.",

  // Auth UI
  signin: "Sign in",
  signup: "Sign up",
  login_title: "Log in",
  signup_title: "Create account",
  welcome_back: "Welcome back.",
  signup_journey: "Sign up to start your journey",
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

  // Forgot password
  forgot_pw: "Forgot password?",
  reset_title: "Reset password",
  reset_sub: "Enter your email and we'll send a reset link.",
  send_reset: "Send reset link",
  back_to_login: "Back to login",
  reset_sent:
   "If an account exists for that email, a reset link has been sent.",

  // Misc / footer
  one_platform: "One platform. One journey. Real connections that matter.",
  after_login: "After login, you will continue inside the GreenPass app.",

  // Errors
  google_fail: "Google sign-in failed.",
  apple_fail: "Apple sign-in failed.",
  generic_error: "Something went wrong.",

  // Role cards
  agent_b1: "Access verified schools and programs",
  agent_b2: "Track student leads and cases clearly",
  agent_b3: "Build long-term, trusted partnerships",
  agent_desc: "Work directly with real schools. No middle layers",
  join_agent: "Join as an Agent",
  join_school: "Join as a School",
  join_student: "Join as a Student",
  join_tutor: "Join as a Tutor",
  role_agent: "Agent",
  role_school: "School",
  role_student: "Student",
  role_tutor: "Tutor",
  school_b1: "Reach verified agents worldwide",
  school_b2: "Manage recruitment transparently",
  school_b3: "Reduce marketing and admission costs",
  school_desc: "Connect with trusted global agents and students",

  // Tutor / Student cards
  tutor_desc: "Support students globally and grow your practice",
  tutor_b1: "Find students internationally",
  tutor_b2: "Offer academic and pathway support",
  tutor_b3: "Build your professional profile",
  student_desc: "Find schools, agents, and tutors you can trust",
  student_b1: "Discover verified schools and programs",
  student_b2: "Connect with reliable agents and tutors",
  student_b3: "Get guided step by step transparently",
 },

 vi: {
  hero_line1: "Du học. Làm việc quốc tế.",
  hero_line2: "Xây dựng tương lai cùng GreenPass.",
  hero_sub:
   "GreenPass là nền tảng tất cả-trong-một dành cho du học sinh kết nối với trường đã xác minh, tư vấn viên, gia sư, việc làm và hỗ trợ di trú tại một nơi.",

  hero_h1_1: "Thị trường toàn cầu kết nối",
  hero_h1_2: "Trường học, Tư vấn viên, Gia sư & Học sinh",
  hero_tagline:
   "Du học, việc làm và lộ trình di trú kết nối minh bạch trên một nền tảng đáng tin cậy.",
  promo_title: "Xây dựng mạng lưới giáo dục & sự nghiệp toàn cầu cùng GreenPass",
  promo_body:
   "GreenPass là nền tảng đáng tin cậy nơi trường học kết nối với tư vấn viên đã xác minh, tư vấn viên hỗ trợ học sinh, gia sư hướng dẫn học tập, và mọi người cùng phát triển minh bạch và hiệu quả.",
  trust_verified: "✔ Hồ sơ đã xác minh",
  trust_transparent: "✔ Hợp tác minh bạch",
  trust_no_hidden: "✔ Không có ẩn ý",
  promo_cta_join: "Tham gia GreenPass — Bắt đầu kết nối ngay",
  promo_cta_signin: "Đăng nhập",
  card1_title: "Trường đã xác minh",
  card1_sub: "Khám phá các trường uy tín.",
  card2_title: "Một ứng dụng. Một hành trình.",
  card2_sub: "Học • Làm • Hỗ trợ di trú trong một nơi.",
  card3_title: "Gia sư & Tư vấn",
  card3_sub: "Được hướng dẫn từng bước.",

  agent_b1: "Truy cập trường và chương trình đã xác minh",
  agent_b2: "Theo dõi hồ sơ và tiến độ rõ ràng",
  agent_b3: "Xây dựng hợp tác lâu dài, đáng tin cậy",
  agent_desc: "Làm việc trực tiếp với trường thật, không qua trung gian",
  apple: "Tiếp tục với Apple",
  choose_role: "Chọn vai trò",
  confirm: "Xác nhận mật khẩu",
  confirm_ph: "Xác nhận mật khẩu",
  cta_login: "Đăng nhập",
  cta_signup: "Tạo tài khoản",
  email: "Email",
  email_in_use: "Email đã được sử dụng.",
  email_ph: "Địa chỉ email",
  google: "Tiếp tục với Google",
  have_account: "Đã có tài khoản?",
  invalid_creds: "Email hoặc mật khẩu không đúng.",
  join_agent: "Tham gia với tư cách Tư vấn viên",
  join_school: "Tham gia với tư cách Trường",
  join_student: "Tham gia với tư cách Học viên",
  join_tutor: "Tham gia với tư cách Gia sư",
  loading: "Vui lòng đợi…",
  login_title: "Đăng nhập",
  no_account: "Chưa có tài khoản?",
  or: "HOẶC",
  password: "Mật khẩu",
  password_ph: "Mật khẩu",
  pw_mismatch: "Mật khẩu không khớp.",
  role_agent: "Tư vấn viên",
  role_required: "Vui lòng chọn vai trò.",
  role_school: "Trường",
  role_student: "Học viên",
  role_tutor: "Gia sư",
  school_b1: "Tiếp cận tư vấn viên đã xác minh trên toàn thế giới",
  school_b2: "Quản lý tuyển sinh minh bạch",
  school_b3: "Giảm chi phí tiếp thị và tuyển sinh",
  school_desc: "Kết nối với tư vấn viên và học viên đáng tin cậy trên toàn cầu",
  select_role: "Chọn vai trò…",
  signin: "Đăng nhập",
  signup: "Đăng ký",
  signup_title: "Tạo tài khoản",
  welcome_back: "Chào mừng bạn quay lại.",
  signup_journey: "Đăng ký để bắt đầu hành trình của bạn",
  weak_pw: "Mật khẩu phải có ít nhất 6 ký tự.",

  forgot_pw: "Quên mật khẩu?",
  reset_title: "Đặt lại mật khẩu",
  reset_sub: "Nhập email và chúng tôi sẽ gửi liên kết đặt lại.",
  send_reset: "Gửi liên kết",
  back_to_login: "Quay lại đăng nhập",
  reset_sent:
   "Nếu tài khoản tồn tại, liên kết đặt lại sẽ được gửi đến email đó.",

  one_platform: "Một nền tảng. Một hành trình. Kết nối thật sự có ý nghĩa.",
  after_login: "Sau khi đăng nhập, bạn sẽ tiếp tục trong ứng dụng GreenPass.",

  google_fail: "Đăng nhập Google thất bại.",
  apple_fail: "Đăng nhập Apple thất bại.",
  generic_error: "Đã xảy ra lỗi.",

  tutor_desc: "Hỗ trợ học viên trên toàn cầu và phát triển hoạt động của bạn",
  tutor_b1: "Tìm học viên quốc tế",
  tutor_b2: "Hỗ trợ học tập và lộ trình học",
  tutor_b3: "Xây dựng hồ sơ chuyên nghiệp của bạn",
  student_desc: "Tìm trường học, tư vấn viên và gia sư đáng tin cậy",
  student_b1: "Khám phá các trường và chương trình đã được xác minh",
  student_b2: "Kết nối với tư vấn viên và gia sư uy tín",
  student_b3: "Được hướng dẫn từng bước một cách minh bạch",
 },

 fil: {
  hero_h1_1: "Ang Pandaigdigang Marketplace na Nag-uugnay",
  hero_h1_2: "Mga Paaralan, Ahente, Tutor at Estudyante",
  hero_tagline:
   "Pag-aaral, trabaho, at mga landas sa imigrasyon—transparent na konektado sa isang mapagkakatiwalaang platform.",
  trust_verified: "✔ Na-verify na profiles",
  trust_transparent: "✔ Transparent na partnerships",
  trust_no_hidden: "✔ Walang hidden agenda",
  signin: "Mag-sign in",
  signup: "Mag-sign up",
  login_title: "Mag-log in",
  signup_title: "Gumawa ng account",
  welcome_back: "Welcome back.",
  signup_journey: "Mag-sign up para simulan ang iyong journey",
  google: "Magpatuloy gamit ang Google",
  apple: "Magpatuloy gamit ang Apple",
  or: "O",
  choose_role: "Pumili ng role",
  select_role: "Pumili ng role…",
  email: "Email",
  email_ph: "Email address",
  password: "Password",
  password_ph: "Password",
  confirm: "Kumpirmahin ang password",
  confirm_ph: "Kumpirmahin ang password",
  cta_login: "Mag-log in",
  cta_signup: "Gumawa ng account",
  have_account: "May account na?",
  no_account: "Wala pang account?",
  role_required: "Pumili muna ng role.",
  pw_mismatch: "Hindi magkapareho ang password.",
  weak_pw: "Dapat 6 na character pataas ang password.",
  invalid_creds: "Maling email o password.",
  email_in_use: "Ginagamit na ang email.",
  loading: "Sandali lang…",
  forgot_pw: "Nakalimutan ang password?",
  reset_title: "I-reset ang password",
  reset_sub: "Ilagay ang email at magpapadala kami ng reset link.",
  send_reset: "Ipadala ang reset link",
  back_to_login: "Bumalik sa login",
  reset_sent:
   "Kung may account para sa email na iyon, naipadala na ang reset link.",
  role_school: "Paaralan",
  role_agent: "Ahente",
  role_student: "Estudyante",
  role_tutor: "Tutor",
  school_desc: "Kumonekta sa mapagkakatiwalaang ahente at estudyante sa buong mundo",
  agent_desc: "Direktang makipagtrabaho sa totoong schools—walang middle layers",
  student_desc: "Maghanap ng schools, agents, at tutors na mapagkakatiwalaan",
  tutor_desc: "Suportahan ang mga estudyante sa buong mundo at palaguin ang iyong practice",
  one_platform: "Isang platform. Isang journey. Tunay na koneksyong mahalaga.",
  after_login: "Pagkatapos mag-login, magpapatuloy ka sa loob ng GreenPass app.",
  google_fail: "Hindi nagtagumpay ang Google sign-in.",
  apple_fail: "Hindi nagtagumpay ang Apple sign-in.",
  generic_error: "May nangyaring error.",
 },

 ceb: {
  hero_h1_1: "Ang Global Marketplace nga Nagkonektar",
  hero_h1_2: "Mga Eskwelahan, Ahente, Tutor ug Estudyante",
  hero_tagline:
   "Pagtuon, trabaho, ug mga dalan sa imigrasyon—klaro ug transparent sa usa ka kasaligan nga platform.",
  trust_verified: "✔ Verified nga profiles",
  trust_transparent: "✔ Transparent nga partnerships",
  trust_no_hidden: "✔ Walay tinaguan",
  signin: "Log in",
  signup: "Sign up",
  login_title: "Log in",
  signup_title: "Himoa ang account",
  welcome_back: "Welcome balik.",
  signup_journey: "Sign up para masugdan ang imong journey",
  google: "Padayon gamit ang Google",
  apple: "Padayon gamit ang Apple",
  or: "O",
  choose_role: "Pili ug role",
  select_role: "Pili ug role…",
  email: "Email",
  email_ph: "Email address",
  password: "Password",
  password_ph: "Password",
  confirm: "Kumpirmaha ang password",
  confirm_ph: "Kumpirmaha ang password",
  cta_login: "Log in",
  cta_signup: "Himoa ang account",
  have_account: "Naa kay account?",
  no_account: "Wala pay account?",
  role_required: "Palihog pili ug role.",
  pw_mismatch: "Dili magkapareho ang password.",
  weak_pw: "Ang password kinahanglan 6 ka karakter pataas.",
  invalid_creds: "Sayop nga email o password.",
  email_in_use: "Gigamit na ang email.",
  loading: "Palihog hulat…",
  forgot_pw: "Nakalimot sa password?",
  reset_title: "I-reset ang password",
  reset_sub: "Ibutang ang imong email ug magpadala mi ug reset link.",
  send_reset: "Ipadala ang reset link",
  back_to_login: "Balik sa login",
  reset_sent:
   "Kung naa'y account para ana nga email, napadala na ang reset link.",
  role_school: "Eskwelahan",
  role_agent: "Ahente",
  role_student: "Estudyante",
  role_tutor: "Tutor",
  one_platform: "Usa ka platform. Usa ka journey. Tinuod nga koneksyon nga naay pulos.",
  after_login: "Human sa login, mupadayon ka sulod sa GreenPass app.",
  google_fail: "Napakyas ang Google sign-in.",
  apple_fail: "Napakyas ang Apple sign-in.",
  generic_error: "Naay sayop nga nahitabo.",
 },

 es: {
  hero_h1_1: "El Mercado Global que Conecta",
  hero_h1_2: "Escuelas, Agentes, Tutores y Estudiantes",
  hero_tagline:
   "Estudio, trabajo y rutas de inmigración—conectados con transparencia en una plataforma confiable.",
  trust_verified: "✔ Perfiles verificados",
  trust_transparent: "✔ Alianzas transparentes",
  trust_no_hidden: "✔ Sin agendas ocultas",
  signin: "Iniciar sesión",
  signup: "Registrarse",
  login_title: "Iniciar sesión",
  signup_title: "Crear cuenta",
  welcome_back: "Bienvenido/a de nuevo.",
  signup_journey: "Regístrate para comenzar tu camino",
  google: "Continuar con Google",
  apple: "Continuar con Apple",
  or: "O",
  choose_role: "Elegir rol",
  select_role: "Selecciona un rol…",
  email: "Correo",
  email_ph: "Dirección de correo",
  password: "Contraseña",
  password_ph: "Contraseña",
  confirm: "Confirmar contraseña",
  confirm_ph: "Confirmar contraseña",
  cta_login: "Entrar",
  cta_signup: "Crear cuenta",
  have_account: "¿Ya tienes cuenta?",
  no_account: "¿No tienes cuenta?",
  role_required: "Selecciona un rol.",
  pw_mismatch: "Las contraseñas no coinciden.",
  weak_pw: "La contraseña debe tener al menos 6 caracteres.",
  invalid_creds: "Correo o contraseña inválidos.",
  email_in_use: "El correo ya está en uso.",
  loading: "Espera…",
  forgot_pw: "¿Olvidaste la contraseña?",
  reset_title: "Restablecer contraseña",
  reset_sub: "Ingresa tu correo y te enviaremos un enlace de restablecimiento.",
  send_reset: "Enviar enlace",
  back_to_login: "Volver al inicio",
  reset_sent:
   "Si existe una cuenta con ese correo, se envió un enlace de restablecimiento.",
  role_school: "Escuela",
  role_agent: "Agente",
  role_student: "Estudiante",
  role_tutor: "Tutor",
  one_platform: "Una plataforma. Un camino. Conexiones reales que importan.",
  after_login: "Después de iniciar sesión, continuarás dentro de la app GreenPass.",
  google_fail: "Error al iniciar sesión con Google.",
  apple_fail: "Error al iniciar sesión con Apple.",
  generic_error: "Algo salió mal.",
 },

 ja: {
  hero_h1_1: "世界をつなぐグローバル・マーケットプレイス",
  hero_h1_2: "学校・エージェント・チューター・学生",
  hero_tagline:
   "留学、就労、移民ルートを、信頼できるプラットフォームで透明に接続します。",
  trust_verified: "✔ 認証済みプロフィール",
  trust_transparent: "✔ 透明なパートナーシップ",
  trust_no_hidden: "✔ 隠れた意図なし",
  signin: "ログイン",
  signup: "新規登録",
  login_title: "ログイン",
  signup_title: "アカウント作成",
  welcome_back: "おかえりなさい。",
  signup_journey: "登録して旅を始めましょう",
  google: "Googleで続行",
  apple: "Appleで続行",
  or: "または",
  choose_role: "役割を選択",
  select_role: "役割を選択…",
  email: "メール",
  email_ph: "メールアドレス",
  password: "パスワード",
  password_ph: "パスワード",
  confirm: "パスワード確認",
  confirm_ph: "パスワード確認",
  cta_login: "ログイン",
  cta_signup: "作成する",
  have_account: "アカウントをお持ちですか？",
  no_account: "アカウントをお持ちでないですか？",
  role_required: "役割を選択してください。",
  pw_mismatch: "パスワードが一致しません。",
  weak_pw: "パスワードは6文字以上です。",
  invalid_creds: "メールまたはパスワードが無効です。",
  email_in_use: "このメールは既に使用されています。",
  loading: "お待ちください…",
  forgot_pw: "パスワードをお忘れですか？",
  reset_title: "パスワード再設定",
  reset_sub: "メールを入力すると再設定リンクを送信します。",
  send_reset: "リンクを送信",
  back_to_login: "ログインに戻る",
  reset_sent:
   "該当するアカウントが存在する場合、再設定リンクを送信しました。",
  role_school: "学校",
  role_agent: "エージェント",
  role_student: "学生",
  role_tutor: "チューター",
  one_platform: "ひとつのプラットフォーム。ひとつの旅。本当に大切なつながりを。",
  after_login: "ログイン後はGreenPassアプリ内へ移動します。",
  google_fail: "Googleでのログインに失敗しました。",
  apple_fail: "Appleでのログインに失敗しました。",
  generic_error: "問題が発生しました。",
 },

 ko: {
  hero_h1_1: "전 세계를 연결하는 글로벌 마켓플레이스",
  hero_h1_2: "학교, 에이전트, 튜터, 학생",
  hero_tagline:
   "유학, 취업, 이민 경로를 한 곳에서 투명하게 연결합니다.",
  trust_verified: "✔ 검증된 프로필",
  trust_transparent: "✔ 투명한 파트너십",
  trust_no_hidden: "✔ 숨겨진 의도 없음",
  signin: "로그인",
  signup: "회원가입",
  login_title: "로그인",
  signup_title: "계정 만들기",
  welcome_back: "다시 오신 것을 환영합니다.",
  signup_journey: "가입하고 여정을 시작하세요",
  google: "Google로 계속하기",
  apple: "Apple로 계속하기",
  or: "또는",
  choose_role: "역할 선택",
  select_role: "역할을 선택하세요…",
  email: "이메일",
  email_ph: "이메일 주소",
  password: "비밀번호",
  password_ph: "비밀번호",
  confirm: "비밀번호 확인",
  confirm_ph: "비밀번호 확인",
  cta_login: "로그인",
  cta_signup: "계정 만들기",
  have_account: "계정이 있나요?",
  no_account: "계정이 없나요?",
  role_required: "역할을 선택해 주세요.",
  pw_mismatch: "비밀번호가 일치하지 않습니다.",
  weak_pw: "비밀번호는 6자 이상이어야 합니다.",
  invalid_creds: "이메일 또는 비밀번호가 올바르지 않습니다.",
  email_in_use: "이미 사용 중인 이메일입니다.",
  loading: "잠시만요…",
  forgot_pw: "비밀번호를 잊으셨나요?",
  reset_title: "비밀번호 재설정",
  reset_sub: "이메일을 입력하면 재설정 링크를 보내드립니다.",
  send_reset: "링크 보내기",
  back_to_login: "로그인으로 돌아가기",
  reset_sent:
   "해당 이메일의 계정이 존재하면 재설정 링크가 전송되었습니다.",
  role_school: "학교",
  role_agent: "에이전트",
  role_student: "학생",
  role_tutor: "튜터",
  one_platform: "하나의 플랫폼. 하나의 여정. 의미 있는 진짜 연결.",
  after_login: "로그인 후 GreenPass 앱으로 계속 이동합니다.",
  google_fail: "Google 로그인에 실패했습니다.",
  apple_fail: "Apple 로그인에 실패했습니다.",
  generic_error: "문제가 발생했습니다.",
 },

 zh: {
  hero_h1_1: "连接全球的国际化平台",
  hero_h1_2: "学校、代理、导师与学生",
  hero_tagline:
   "留学、工作与移民路径，在一个可信平台上透明连接。",
  trust_verified: "✔ 已验证资料",
  trust_transparent: "✔ 透明合作",
  trust_no_hidden: "✔ 无隐藏条件",
  signin: "登录",
  signup: "注册",
  login_title: "登录",
  signup_title: "创建账号",
  welcome_back: "欢迎回来。",
  signup_journey: "注册以开启你的旅程",
  google: "使用 Google 继续",
  apple: "使用 Apple 继续",
  or: "或",
  choose_role: "选择角色",
  select_role: "选择一个角色…",
  email: "邮箱",
  email_ph: "邮箱地址",
  password: "密码",
  password_ph: "密码",
  confirm: "确认密码",
  confirm_ph: "确认密码",
  cta_login: "登录",
  cta_signup: "创建账号",
  have_account: "已有账号？",
  no_account: "还没有账号？",
  role_required: "请选择角色。",
  pw_mismatch: "两次密码不一致。",
  weak_pw: "密码至少 6 个字符。",
  invalid_creds: "邮箱或密码不正确。",
  email_in_use: "该邮箱已被使用。",
  loading: "请稍候…",
  forgot_pw: "忘记密码？",
  reset_title: "重置密码",
  reset_sub: "输入邮箱，我们将发送重置链接。",
  send_reset: "发送重置链接",
  back_to_login: "返回登录",
  reset_sent:
   "如果该邮箱对应的账号存在，重置链接已发送。",
  role_school: "学校",
  role_agent: "代理",
  role_student: "学生",
  role_tutor: "导师",
  one_platform: "一个平台，一个旅程。真正重要的连接。",
  after_login: "登录后，你将继续进入 GreenPass 应用。",
  google_fail: "Google 登录失败。",
  apple_fail: "Apple 登录失败。",
  generic_error: "出现错误。",
 },

 ar: {
  hero_h1_1: "السوق العالمي الذي يربط",
  hero_h1_2: "المدارس والوكلاء والمدرسين والطلاب",
  hero_tagline:
   "الدراسة والعمل ومسارات الهجرة—متصلة بشفافية عبر منصة موثوقة.",
  trust_verified: "✔ ملفات موثّقة",
  trust_transparent: "✔ شراكات شفافة",
  trust_no_hidden: "✔ بدون أجندات خفية",
  signin: "تسجيل الدخول",
  signup: "إنشاء حساب",
  login_title: "تسجيل الدخول",
  signup_title: "إنشاء حساب",
  welcome_back: "مرحبًا بعودتك.",
  signup_journey: "أنشئ حسابًا لبدء رحلتك",
  google: "المتابعة عبر Google",
  apple: "المتابعة عبر Apple",
  or: "أو",
  choose_role: "اختر الدور",
  select_role: "اختر دورًا…",
  email: "البريد الإلكتروني",
  email_ph: "عنوان البريد الإلكتروني",
  password: "كلمة المرور",
  password_ph: "كلمة المرور",
  confirm: "تأكيد كلمة المرور",
  confirm_ph: "تأكيد كلمة المرور",
  cta_login: "تسجيل الدخول",
  cta_signup: "إنشاء حساب",
  have_account: "لديك حساب؟",
  no_account: "ليس لديك حساب؟",
  role_required: "يرجى اختيار دور.",
  pw_mismatch: "كلمتا المرور غير متطابقتين.",
  weak_pw: "يجب أن تكون كلمة المرور 6 أحرف على الأقل.",
  invalid_creds: "بريد إلكتروني أو كلمة مرور غير صحيحة.",
  email_in_use: "البريد الإلكتروني مستخدم بالفعل.",
  loading: "يرجى الانتظار…",
  forgot_pw: "نسيت كلمة المرور؟",
  reset_title: "إعادة تعيين كلمة المرور",
  reset_sub: "أدخل بريدك الإلكتروني وسنرسل رابط إعادة التعيين.",
  send_reset: "إرسال رابط إعادة التعيين",
  back_to_login: "العودة لتسجيل الدخول",
  reset_sent:
   "إذا كان هناك حساب لهذا البريد، فقد تم إرسال رابط إعادة التعيين.",
  role_school: "مدرسة",
  role_agent: "وكيل",
  role_student: "طالب",
  role_tutor: "مدرس",
  one_platform: "منصة واحدة. رحلة واحدة. علاقات حقيقية لها معنى.",
  after_login: "بعد تسجيل الدخول ستتابع داخل تطبيق GreenPass.",
  google_fail: "فشل تسجيل الدخول عبر Google.",
  apple_fail: "فشل تسجيل الدخول عبر Apple.",
  generic_error: "حدث خطأ ما.",
 },

 "pt-BR": {
  hero_h1_1: "O Marketplace Global que Conecta",
  hero_h1_2: "Escolas, Agentes, Tutores e Estudantes",
  hero_tagline:
   "Estudo, trabalho e caminhos de imigração—conectados com transparência em uma plataforma confiável.",
  trust_verified: "✔ Perfis verificados",
  trust_transparent: "✔ Parcerias transparentes",
  trust_no_hidden: "✔ Sem agendas ocultas",
  signin: "Entrar",
  signup: "Criar conta",
  login_title: "Entrar",
  signup_title: "Criar conta",
  welcome_back: "Bem-vindo(a) de volta.",
  signup_journey: "Cadastre-se para começar sua jornada",
  google: "Continuar com Google",
  apple: "Continuar com Apple",
  or: "OU",
  choose_role: "Escolher função",
  select_role: "Selecione uma função…",
  email: "E-mail",
  email_ph: "Endereço de e-mail",
  password: "Senha",
  password_ph: "Senha",
  confirm: "Confirmar senha",
  confirm_ph: "Confirmar senha",
  cta_login: "Entrar",
  cta_signup: "Criar conta",
  have_account: "Já tem conta?",
  no_account: "Não tem conta?",
  role_required: "Selecione uma função.",
  pw_mismatch: "As senhas não coincidem.",
  weak_pw: "A senha deve ter pelo menos 6 caracteres.",
  invalid_creds: "E-mail ou senha inválidos.",
  email_in_use: "O e-mail já está em uso.",
  loading: "Aguarde…",
  forgot_pw: "Esqueceu a senha?",
  reset_title: "Redefinir senha",
  reset_sub: "Informe seu e-mail e enviaremos um link de redefinição.",
  send_reset: "Enviar link",
  back_to_login: "Voltar ao login",
  reset_sent:
   "Se existir uma conta para esse e-mail, um link de redefinição foi enviado.",
  role_school: "Escola",
  role_agent: "Agente",
  role_student: "Estudante",
  role_tutor: "Tutor",
  one_platform: "Uma plataforma. Uma jornada. Conexões reais que importam.",
  after_login: "Após entrar, você continuará dentro do app GreenPass.",
  google_fail: "Falha ao entrar com Google.",
  apple_fail: "Falha ao entrar com Apple.",
  generic_error: "Algo deu errado.",
 },

 fr: {
  hero_h1_1: "La place de marché mondiale qui connecte",
  hero_h1_2: "Écoles, Agents, Tuteurs et Étudiants",
  hero_tagline:
   "Études, travail et parcours d’immigration—connectés en toute transparence sur une plateforme de confiance.",
  trust_verified: "✔ Profils vérifiés",
  trust_transparent: "✔ Partenariats transparents",
  trust_no_hidden: "✔ Aucune agenda caché",
  signin: "Se connecter",
  signup: "S’inscrire",
  login_title: "Connexion",
  signup_title: "Créer un compte",
  welcome_back: "Bon retour.",
  signup_journey: "Inscrivez-vous pour commencer votre parcours",
  google: "Continuer avec Google",
  apple: "Continuer avec Apple",
  or: "OU",
  choose_role: "Choisir un rôle",
  select_role: "Sélectionnez un rôle…",
  email: "E-mail",
  email_ph: "Adresse e-mail",
  password: "Mot de passe",
  password_ph: "Mot de passe",
  confirm: "Confirmer le mot de passe",
  confirm_ph: "Confirmer le mot de passe",
  cta_login: "Se connecter",
  cta_signup: "Créer un compte",
  have_account: "Vous avez déjà un compte ?",
  no_account: "Vous n’avez pas de compte ?",
  role_required: "Veuillez sélectionner un rôle.",
  pw_mismatch: "Les mots de passe ne correspondent pas.",
  weak_pw: "Le mot de passe doit contenir au moins 6 caractères.",
  invalid_creds: "E-mail ou mot de passe invalide.",
  email_in_use: "L’e-mail est déjà utilisé.",
  loading: "Veuillez patienter…",
  forgot_pw: "Mot de passe oublié ?",
  reset_title: "Réinitialiser le mot de passe",
  reset_sub: "Entrez votre e-mail et nous enverrons un lien de réinitialisation.",
  send_reset: "Envoyer le lien",
  back_to_login: "Retour à la connexion",
  reset_sent:
   "Si un compte existe pour cet e-mail, un lien a été envoyé.",
  role_school: "École",
  role_agent: "Agent",
  role_student: "Étudiant",
  role_tutor: "Tuteur",
  one_platform: "Une plateforme. Un parcours. Des connexions réelles qui comptent.",
  after_login: "Après connexion, vous continuerez dans l’application GreenPass.",
  google_fail: "Échec de la connexion Google.",
  apple_fail: "Échec de la connexion Apple.",
  generic_error: "Une erreur est survenue.",
 },

 de: {
  hero_h1_1: "Der globale Marktplatz, der verbindet",
  hero_h1_2: "Schulen, Agenten, Tutor:innen & Studierende",
  hero_tagline:
   "Studium, Arbeit und Einwanderungswege—transparent verbunden auf einer vertrauenswürdigen Plattform.",
  trust_verified: "✔ Verifizierte Profile",
  trust_transparent: "✔ Transparente Partnerschaften",
  trust_no_hidden: "✔ Keine versteckten Absichten",
  signin: "Anmelden",
  signup: "Registrieren",
  login_title: "Anmelden",
  signup_title: "Konto erstellen",
  welcome_back: "Willkommen zurück.",
  signup_journey: "Registriere dich, um deine Reise zu starten",
  google: "Mit Google fortfahren",
  apple: "Mit Apple fortfahren",
  or: "ODER",
  choose_role: "Rolle wählen",
  select_role: "Rolle auswählen…",
  email: "E-Mail",
  email_ph: "E-Mail-Adresse",
  password: "Passwort",
  password_ph: "Passwort",
  confirm: "Passwort bestätigen",
  confirm_ph: "Passwort bestätigen",
  cta_login: "Anmelden",
  cta_signup: "Konto erstellen",
  have_account: "Schon ein Konto?",
  no_account: "Noch kein Konto?",
  role_required: "Bitte eine Rolle auswählen.",
  pw_mismatch: "Passwörter stimmen nicht überein.",
  weak_pw: "Passwort muss mindestens 6 Zeichen haben.",
  invalid_creds: "Ungültige E-Mail oder Passwort.",
  email_in_use: "E-Mail wird bereits verwendet.",
  loading: "Bitte warten…",
  forgot_pw: "Passwort vergessen?",
  reset_title: "Passwort zurücksetzen",
  reset_sub: "E-Mail eingeben, wir senden einen Reset-Link.",
  send_reset: "Reset-Link senden",
  back_to_login: "Zurück zum Login",
  reset_sent:
   "Wenn ein Konto zu dieser E-Mail existiert, wurde ein Link gesendet.",
  role_school: "Schule",
  role_agent: "Agent",
  role_student: "Studierende",
  role_tutor: "Tutor:in",
  one_platform: "Eine Plattform. Eine Reise. Echte Verbindungen, die zählen.",
  after_login: "Nach dem Login geht es in der GreenPass-App weiter.",
  google_fail: "Google-Anmeldung fehlgeschlagen.",
  apple_fail: "Apple-Anmeldung fehlgeschlagen.",
  generic_error: "Etwas ist schiefgelaufen.",
 },
} as any;

function tr(lang: LangCode, key: string, def?: string) {
 return TX[lang]?.[key] || TX.en[key] || def || key;
}

async function ensureUserDoc(user: User, role?: RoleValue) {
 const ref = doc(db, "users", user.uid);
 const snap = await getDoc(ref);

 const chosen = role;

 if (!snap.exists()) {
  // If role is not provided (eg invite flow sets role server-side),
  // do NOT default to student here.
  const base: any = {
   uid: user.uid,
   email: user.email || "",
   full_name: user.displayName || "",
   onboarding_completed: false,
   onboarding_step: "basic_info",
   created_at: serverTimestamp(),
   updated_at: serverTimestamp(),
  };

  if (chosen) {
   base.selected_role = chosen;
   base.user_type = chosen;
   base.userType = chosen;
   base.role = chosen;
  }

  await setDoc(ref, base);
  return { exists: false, data: null as any };
 }

 const data = snap.data() || {};
 const patch: any = { updated_at: serverTimestamp() };

 // If SEO provided role, fill any missing role fields (do NOT overwrite existing role)
 if (chosen) {
  if (!data.selected_role) patch.selected_role = chosen;
  if (!data.user_type) patch.user_type = chosen;
  if (!data.userType) patch.userType = chosen;
  if (!data.role) patch.role = chosen;
 }

 // If step is missing, default to BASIC_INFO so user doesn't re-pick role.
 if (!data.onboarding_step) patch.onboarding_step = "basic_info";

 // Only write if needed
 const needsWrite = Object.keys(patch).length > 1;
 if (needsWrite) {
  await updateDoc(ref, patch);
 }

 return { exists: true, data };
}

async function routeLikeWelcome(
 user: User,
 lang: LangCode,
 fallbackRole?: RoleValue,
 nextFromUrl?: string,
 invite?: { inviteId: string; token: string }
) {
 // If this is an invite link, lock role server-side first.
 if (invite?.inviteId && invite?.token) {
  await acceptInvite(user, invite.inviteId, invite.token);
 }

 const { exists, data } = await ensureUserDoc(user, fallbackRole);

 const onboardingCompleted = Boolean(data?.onboarding_completed);

 // ✅ Cross-domain auth handoff:
 // SEO (greenpassgroup.com) signs-in the user, then we mint a one-time code
 // and send them to app.greenpassgroup.com/auth-bridge which signs in via custom token.
 const code = await createBridgeCode(user);

 // ✅ Preserve a safe `next` from SEO (e.g. /accept-org-invite?invite=...&token=...)
 const safeNext = safeNextPath(nextFromUrl || "");
 const next = safeNext || (!exists || !onboardingCompleted ? "/onboarding" : "/dashboard");

 // Pass role to AuthBridge (helps NEW users create the right role doc)
 const roleParam = fallbackRole ? `&role=${encodeURIComponent(fallbackRole)}` : "";

 window.location.href = appLink(
  `/auth-bridge?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}${roleParam}`,
  lang
 );
}

/** Normalize lang codes from URL/browser/UI into the exact keys used in TX */
function normalizeLang(input: string): LangCode {
  const raw = (input || "").trim();
  if (!raw) return DEFAULT_LANG;

  // Common variants
  const lower = raw.toLowerCase();
  if (lower === "jp" || lower.startsWith("ja")) return "ja" as LangCode;
  if (lower === "cn" || lower.startsWith("zh")) return "zh" as LangCode;
  if (lower === "pt" || lower.startsWith("pt-")) return "pt-BR" as LangCode;
  if (lower === "tl" || lower.startsWith("fil")) return "fil" as LangCode;

  // Exact match in TX keys (case-sensitive for pt-BR)
  if ((TX as any)[raw]) return raw as LangCode;
  if ((TX as any)[lower]) return lower as LangCode;

  return DEFAULT_LANG;
}

export default function HomeClient() {
 const params = useSearchParams();
 const urlLangRaw = params.get("lang") || "";
 const inviteId = params.get("invite") || "";
 const inviteToken = params.get("token") || "";

 // ✅ Preserve safe `next` (for org invitations and other deep links)
 const rawNextFromUrl = params.get("next") || "";
 const nextFromUrl = safeNextPath(rawNextFromUrl);
 const logout = params.get("logout") === "1";
 const [logoutDone, setLogoutDone] = useState(!logout);

 const hasInvite = Boolean(inviteId && inviteToken);


// ✅ LOAD INVITE ROLE (preselect + lock) when opening an invite link
useEffect(() => {
 let cancelled = false;

 const run = async () => {
  if (!hasInvite) return;

  setInviteRoleLoading(true);
  try {
   const base = FUNCTIONS_BASE.replace(/\/+$/, "");
   const url = `${base}/getInviteRolePublic?inviteId=${encodeURIComponent(inviteId)}&token=${encodeURIComponent(inviteToken)}`;
   const r = await fetch(url, { method: "GET" });
   const data = await r.json();

   if (cancelled) return;

   if (!data?.ok || !data?.role) {
    setMsg("Invalid or expired invite link.");
    return;
   }

   setRole(data.role as RoleValue);

   // Optional: Prefill invited email if returned
   if (data.invitedEmail && typeof data.invitedEmail === "string") {
    setEmail(data.invitedEmail);
   }
  } catch (e) {
   if (!cancelled) setMsg("Could not verify invite link.");
  } finally {
   if (!cancelled) setInviteRoleLoading(false);
  }
 };

 run();
 return () => {
  cancelled = true;
 };
}, [hasInvite, inviteId, inviteToken]);


 useEffect(() => {
  let cancelled = false;

  const run = async () => {
   if (!logout) {
    setLogoutDone(true);
    return;
   }

   setLogoutDone(false);

   try {
    // ✅ Sign out on greenpassgroup.com origin
    await signOut(auth);
   } catch {
    // ignore
   }

   // Best-effort cookie cleanup (covers shared cookies on .greenpassgroup.com)
   try {
    const expire = "Thu, 01 Jan 1970 00:00:00 GMT";
    const domains = [
     ".greenpassgroup.com",
     "greenpassgroup.com",
     ".www.greenpassgroup.com",
     "www.greenpassgroup.com",
    ];
    const names = ["__session", "session", "token", "gp_session", "gp_token"];
    names.forEach((name) => {
     document.cookie = `${name}=; expires=${expire}; path=/`;
     domains.forEach((d) => {
      document.cookie = `${name}=; expires=${expire}; path=/; domain=${d}`;
     });
    });
   } catch {}

   // Remove the logout flag from the URL so normal auth routing can resume cleanly
   try {
    const u = new URL(window.location.href);
    u.searchParams.delete("logout");
    u.searchParams.delete("next");
    u.searchParams.delete("role");
    window.history.replaceState({}, "", u.pathname + (u.search ? u.search : ""));
   } catch {}

   if (!cancelled) setLogoutDone(true);
  };

  run();
  return () => {
   cancelled = true;
  };
 }, [logout]);

 const [lang, setLang] = useState<LangCode>(DEFAULT_LANG);
 const t = useMemo(() => {
  return {
   signin: tr(lang, "signin"),
   signup: tr(lang, "signup"),
   login_title: tr(lang, "login_title"),
   signup_title: tr(lang, "signup_title"),
   welcome_back: tr(lang, "welcome_back"),
   signup_journey: tr(lang, "signup_journey"),
   reset_title: tr(lang, "reset_title"),
   reset_sub: tr(lang, "reset_sub"),
   forgot_pw: tr(lang, "forgot_pw"),
   send_reset: tr(lang, "send_reset"),
   back_to_login: tr(lang, "back_to_login"),
   reset_sent: tr(lang, "reset_sent"),
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
   one_platform: tr(lang, "one_platform"),
   after_login: tr(lang, "after_login"),
   google_fail: tr(lang, "google_fail"),
   apple_fail: tr(lang, "apple_fail"),
   generic_error: tr(lang, "generic_error"),
  };
 }, [lang]);

 // auth UI state
 const [mode, setMode] = useState<"signin" | "signup">("signin");
 

  // ✅ FORCE SIGNUP MODE WHEN INVITE PARAMS EXIST (runs on first client render)
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const invite = p.get("invite");
      const token = p.get("token");
      if (invite && token) setMode("signup");
    } catch {}
  }, []);
const [authView, setAuthView] = useState<"auth" | "forgot">("auth");
 const [busy, setBusy] = useState(false);
 const [msg, setMsg] = useState<string | null>(null);

 useEffect(() => {
  setAuthView("auth");
 }, [mode]);

 const [email, setEmail] = useState("");
 const [password, setPassword] = useState("");
 const [confirm, setConfirm] = useState("");

 // Show/Hide password toggles
 const [showPassword, setShowPassword] = useState(false);
 const [showConfirm, setShowConfirm] = useState(false);

 const [role, setRole] = useState<RoleValue | "">("");

 const [inviteRoleLoading, setInviteRoleLoading] = useState(false);

 // ✅ Initialize language from URL/storage/browser
 useEffect(() => {
  // Prefer explicit URL lang when present; normalize to match TX keys
  const initial = normalizeLang(urlLangRaw || resolveInitialLang());
  setLang(initial);
  setLangEverywhere(initial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);

 // ✅ Keep state in sync if the URL ?lang= changes (e.g. user pasted a link)
 useEffect(() => {
  if (!urlLangRaw) return;
  const normalized = normalizeLang(urlLangRaw);
  if (normalized !== lang) setLang(normalized);
 }, [urlLangRaw, lang]);

// ✅ If already logged in, route like Welcome (BUT never while logout is running)
 useEffect(() => {
  if (logout && !logoutDone) return;

  const unsub = onAuthStateChanged(auth, (user) => {
   if (logout && !logoutDone) return;
   if (user) {
    routeLikeWelcome(
     user,
     lang,
     undefined,
     nextFromUrl,
     hasInvite ? { inviteId, token: inviteToken } : undefined
    ).catch(() => {});
   }
  });
  return () => unsub();
 }, [lang, logout, logoutDone, hasInvite, inviteId, inviteToken]);

 const canSubmit = useMemo(() => {
  if (!email || !password) return false;
  if (mode === "signup") {
  if (hasInvite) {
   if (inviteRoleLoading || !role) return false;
  } else {
   if (!role) return false;
  }
   if (password.length < 6) return false;
   if (password !== confirm) return false;
  }
  return true;
 }, [email, password, confirm, role, mode, hasInvite]);

 function scrollToAuth() {
  if (typeof document === "undefined") return;
  document.getElementById("auth-card")?.scrollIntoView({
   behavior: "smooth",
   block: "start",
  });
 }

 function pickRole(r: RoleValue) {
  setMode("signup");
  setRole(r);
  setAuthView("auth");
  setMsg(null);
  setTimeout(scrollToAuth, 50);
 }

 async function handleEmailAuth() {
  setMsg(null);
  try {
   setBusy(true);

   if (mode === "signin") {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    await routeLikeWelcome(
     cred.user,
     lang,
     undefined,
     nextFromUrl,
     hasInvite ? { inviteId, token: inviteToken } : undefined
    );
    return;
   }

   if (hasInvite && (inviteRoleLoading || !role)) {
    setMsg("Verifying invite… please wait.");
    return;
   }
   if (!hasInvite && !role) {
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

   const cred = await createUserWithEmailAndPassword(
    auth,
    email.trim(),
    password
   );

   if (!hasInvite && role) {
    await ensureUserDoc(cred.user, role as RoleValue);
   }

   await routeLikeWelcome(
    cred.user,
    lang,
    !hasInvite && role ? (role as RoleValue) : undefined,
    nextFromUrl,
    hasInvite ? { inviteId, token: inviteToken } : undefined
   );
  } catch (e: any) {
   const code = String(e?.code || "");
   if (
    code.includes("auth/invalid-credential") ||
    code.includes("auth/wrong-password")
   ) {
    setMsg(t.invalid_creds);
   } else if (code.includes("auth/email-already-in-use")) {
    setMsg(t.email_in_use);
   } else if (code.includes("auth/weak-password")) {
    setMsg(t.weak_pw);
   } else {
    setMsg(e?.message || t.generic_error);
   }
  } finally {
   setBusy(false);
  }
 }

 async function handleSendReset() {
  setMsg(null);
  try {
   setBusy(true);
   await sendPasswordResetEmail(auth, email.trim());
   setMsg(t.reset_sent);
  } catch {
   setMsg(t.reset_sent);
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
   await routeLikeWelcome(
    cred.user,
    lang,
    !hasInvite && role ? (role as RoleValue) : undefined,
    nextFromUrl,
    hasInvite ? { inviteId, token: inviteToken } : undefined
   );
  } catch (e: any) {
   setMsg(e?.message || t.google_fail);
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
   await routeLikeWelcome(
    cred.user,
    lang,
    !hasInvite && role ? (role as RoleValue) : undefined,
    nextFromUrl,
    hasInvite ? { inviteId, token: inviteToken } : undefined
   );
  } catch (e: any) {
   setMsg(e?.message || t.apple_fail);
  } finally {
   setBusy(false);
  }
 }

 return (
  <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900">
   <Navbar
    lang={lang}
    onLangChange={(code) => {
     const normalized = normalizeLang(String(code));
     setLang(normalized);
     setLangEverywhere(normalized);
    }}
   />

   <main className="w-full flex-1 min-h-0 overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-800 px-2 sm:px-4 lg:px-6 pt-4 pb-4 lg:pt-4 lg:pb-4">
    <div className="grid flex-1 min-h-0 grid-cols-1 items-center gap-8 lg:gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(320px,520px)] xl:grid-cols-[minmax(0,1fr)_minmax(360px,560px)]">
     <section className="lg:pr-6 xl:pr-10">
      <div className="relative overflow-hidden rounded-[44px] border border-white/15 bg-white/10 p-4 sm:p-6 lg:p-7 shadow-[0_22px_90px_rgba(0,0,0,0.35)] backdrop-blur">
       <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(900px_circle_at_15%_20%,rgba(255,255,255,0.22),transparent_55%),radial-gradient(900px_circle_at_85%_30%,rgba(16,185,129,0.18),transparent_55%),radial-gradient(900px_circle_at_60%_90%,rgba(255,255,255,0.10),transparent_55%)]" />
       <div className="relative">
        <h1 className="mt-2 text-center text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
         <span className="block">
          {tr(lang, "hero_h1_1", "The Global Marketplace Connecting")}
         </span>
         <span className="block">
          {tr(lang, "hero_h1_2", "Schools, Agents, Tutors & Students")}
         </span>
        </h1>

        <p className="mx-auto mt-2 max-w-2xl text-center text-sm leading-6 text-white/85 sm:text-base">
         {tr(
          lang,
          "hero_tagline",
          "Study, work, and immigration pathways. Connected transparently in one trusted platform."
         )}
        </p>

        {/* Infographic layout (desktop) */}
        <div className="relative mt-2 hidden md:block h-[62vh] min-h-[460px] max-h-[600px] lg:max-h-[640px]">
         <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative h-[640px] w-[1000px] origin-center scale-[0.78] lg:scale-[0.85] xl:scale-[0.9]">
           <svg
            className="absolute inset-0 z-0 h-full w-full opacity-70"
            viewBox="0 0 1000 640"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
           >
            <defs>
             <linearGradient id="gpGreen" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="rgba(52,211,153,0.95)" />
              <stop offset="1" stopColor="rgba(16,185,129,0.25)" />
             </linearGradient>
             <linearGradient id="gpBlue" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="rgba(96,165,250,0.95)" />
              <stop offset="1" stopColor="rgba(59,130,246,0.25)" />
             </linearGradient>
             <linearGradient id="gpPurple" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="rgba(167,139,250,0.95)" />
              <stop offset="1" stopColor="rgba(124,58,237,0.25)" />
             </linearGradient>
             <linearGradient id="gpAmber" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="rgba(251,191,36,0.95)" />
              <stop offset="1" stopColor="rgba(245,158,11,0.25)" />
             </linearGradient>

             <marker
              id="arrowGreen"
              viewBox="0 0 12 12"
              markerWidth="10"
              markerHeight="10"
              refX="10"
              refY="6"
              orient="auto"
              markerUnits="userSpaceOnUse"
             >
              <path
               d="M0 0 L12 6 L0 12 Z"
               fill="rgba(16,185,129,0.95)"
              />
             </marker>

             <marker
              id="arrowBlue"
              viewBox="0 0 12 12"
              markerWidth="10"
              markerHeight="10"
              refX="10"
              refY="6"
              orient="auto"
              markerUnits="userSpaceOnUse"
             >
              <path
               d="M0 0 L12 6 L0 12 Z"
               fill="rgba(59,130,246,0.95)"
              />
             </marker>

             <marker
              id="arrowPurple"
              viewBox="0 0 12 12"
              markerWidth="10"
              markerHeight="10"
              refX="10"
              refY="6"
              orient="auto"
              markerUnits="userSpaceOnUse"
             >
              <path
               d="M0 0 L12 6 L0 12 Z"
               fill="rgba(124,58,237,0.95)"
              />
             </marker>

             <marker
              id="arrowAmber"
              viewBox="0 0 12 12"
              markerWidth="10"
              markerHeight="10"
              refX="10"
              refY="6"
              orient="auto"
              markerUnits="userSpaceOnUse"
             >
              <path
               d="M0 0 L12 6 L0 12 Z"
               fill="rgba(245,158,11,0.95)"
              />
             </marker>
            </defs>

            <circle
             cx="500"
             cy="320"
             r="120"
             stroke="rgba(255,255,255,0.28)"
             strokeWidth="3"
             strokeDasharray="2 10"
            />
            <circle
             cx="500"
             cy="320"
             r="170"
             stroke="rgba(255,255,255,0.16)"
             strokeWidth="2"
             strokeDasharray="3 14"
            />

            <path
             d="M372.7 192.7 A180 180 0 0 1 627.3 192.7"
             stroke="url(#gpAmber)"
             strokeWidth="12"
             strokeLinecap="round"
             opacity="0.9"
             markerEnd="url(#arrowAmber)"
            />
            <path
             d="M627.3 192.7 A180 180 0 0 1 627.3 447.3"
             stroke="url(#gpBlue)"
             strokeWidth="12"
             strokeLinecap="round"
             opacity="0.9"
             markerEnd="url(#arrowBlue)"
            />
            <path
             d="M627.3 447.3 A180 180 0 0 1 372.7 447.3"
             stroke="url(#gpPurple)"
             strokeWidth="12"
             strokeLinecap="round"
             opacity="0.9"
             markerEnd="url(#arrowPurple)"
            />
            <path
             d="M372.7 447.3 A180 180 0 0 1 372.7 192.7"
             stroke="url(#gpGreen)"
             strokeWidth="12"
             strokeLinecap="round"
             opacity="0.9"
             markerEnd="url(#arrowGreen)"
            />
           </svg>

           <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-white/95 shadow-[0_14px_50px_rgba(0,0,0,0.25)]">
             <div className="absolute inset-[-10px] rounded-full border-2 border-white/30" />
             <span className="text-2xl font-extrabold text-emerald-700">GP</span>
            </div>
           </div>

           <div className="absolute left-0 top-3 z-10 w-[40%] px-2">
            <div className="rounded-3xl bg-white/92 p-4 text-slate-900 text-left shadow-[0_18px_50px_rgba(0,0,0,0.20)]">
             <div className="mb-3 flex items-center justify-center">
              <img
               src="/role-images/role_school.png"
               alt=""
               className="h-20 w-full max-w-[92%] object-contain"
               loading="lazy"
              />
             </div>
             <div className="text-lg font-extrabold">
              {tr(lang, "role_school", "School")}
             </div>
             <div className="mt-1 text-xs text-slate-600">
              {tr(
               lang,
               "school_desc",
               "Connect with trusted global agents and students"
              )}
             </div>
             <ul className="mt-2 space-y-1 text-xs text-slate-700">
              <li className="flex items-start gap-2">
               <span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                ✓
               </span>
               {tr(lang, "school_b1", "Reach verified agents worldwide")}
              </li>
              <li className="flex items-start gap-2">
               <span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                ✓
               </span>
               {tr(lang, "school_b2", "Manage recruitment transparently")}
              </li>
              <li className="flex items-start gap-2">
               <span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                ✓
               </span>
               {tr(lang, "school_b3", "Reduce marketing and admission costs")}
              </li>
             </ul>
            </div>
           </div>

           <div className="absolute right-0 top-3 z-10 w-[40%] px-2">
            <div className="rounded-3xl bg-white/92 p-4 text-slate-900 text-left shadow-[0_18px_50px_rgba(0,0,0,0.20)]">
             <div className="mb-3 flex items-center justify-center">
              <img
               src="/role-images/role_agent.png"
               alt=""
               className="h-20 w-full max-w-[92%] object-contain"
               loading="lazy"
              />
             </div>
             <div className="text-lg font-extrabold">
              {tr(lang, "role_agent", "Agent")}
             </div>
             <div className="mt-1 text-xs text-slate-600">
              {tr(
               lang,
               "agent_desc",
               "Work directly with real schools — no middle layers"
              )}
             </div>
             <ul className="mt-2 space-y-1 text-xs text-slate-700">
              <li className="flex items-start gap-2">
               <span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                ✓
               </span>
               {tr(lang, "agent_b1", "Access verified schools and programs")}
              </li>
              <li className="flex items-start gap-2">
               <span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                ✓
               </span>
               {tr(lang, "agent_b2", "Track applications clearly")}
              </li>
              <li className="flex items-start gap-2">
               <span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                ✓
               </span>
               {tr(lang, "agent_b3", "Build long-term, trusted partnerships")}
              </li>
             </ul>
            </div>
           </div>

           <div className="absolute left-0 bottom-3 z-10 w-[40%] px-2">
            <div className="rounded-3xl bg-white/92 p-4 text-slate-900 text-left shadow-[0_18px_50px_rgba(0,0,0,0.20)]">
             <div className="mb-3 flex items-center justify-center">
              <img
               src="/role-images/role_student.png"
               alt=""
               className="h-20 w-full max-w-[92%] object-contain"
               loading="lazy"
              />
             </div>
             <div className="text-lg font-extrabold">
              {tr(lang, "role_student", "Students")}
             </div>
             <div className="mt-1 text-xs text-slate-600">
              {tr(
               lang,
               "student_desc",
               "Find schools, agents, and tutors you can trust"
              )}
             </div>
             <ul className="mt-2 space-y-1 text-xs text-slate-700">
              <li className="flex items-start gap-2">
               <span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-violet-100 text-violet-700 ring-1 ring-violet-200">
                ✓
               </span>
               {tr(lang, "student_b1", "Discover verified schools and programs")}
              </li>
              <li className="flex items-start gap-2">
               <span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-violet-100 text-violet-700 ring-1 ring-violet-200">
                ✓
               </span>
               {tr(lang, "student_b2", "Connect with reliable agents and tutors")}
              </li>
              <li className="flex items-start gap-2">
               <span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-violet-100 text-violet-700 ring-1 ring-violet-200">
                ✓
               </span>
               {tr(lang, "student_b3", "Get guided step by step transparently")}
              </li>
             </ul>
            </div>
           </div>

           <div className="absolute right-0 bottom-3 z-10 w-[40%] px-2">
            <div className="rounded-3xl bg-white/92 p-4 text-slate-900 text-left shadow-[0_18px_50px_rgba(0,0,0,0.20)]">
             <div className="mb-3 flex items-center justify-center">
              <img
               src="/role-images/role_tutor.jpg"
               alt=""
               className="h-20 w-full max-w-[92%] object-contain"
               loading="lazy"
              />
             </div>
             <div className="text-lg font-extrabold">
              {tr(lang, "role_tutor", "Tutors")}
             </div>
             <div className="mt-1 text-xs text-slate-600">
              {tr(
               lang,
               "tutor_desc",
               "Support students globally and grow your practice"
              )}
             </div>
             <ul className="mt-2 space-y-1 text-xs text-slate-700">
              <li className="flex items-start gap-2">
               <span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                ✓
               </span>
               {tr(lang, "tutor_b1", "Find students internationally")}
              </li>
              <li className="flex items-start gap-2">
               <span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                ✓
               </span>
               {tr(lang, "tutor_b2", "Offer academic and pathway support")}
              </li>
              <li className="flex items-start gap-2">
               <span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                ✓
               </span>
               {tr(lang, "tutor_b3", "Build your professional profile")}
              </li>
             </ul>
            </div>
           </div>
          </div>
         </div>
        </div>

        {/* Mobile cards */}
        <div className="mt-8 grid grid-cols-1 gap-4 md:hidden">
         {(
          [
           {
            k: "role_school",
            d: "School",
            dk: "school_desc",
            dd: "Connect with trusted global agents and students",
           },
           {
            k: "role_agent",
            d: "Agent",
            dk: "agent_desc",
            dd: "Work directly with real schools — no middle layers",
           },
           {
            k: "role_student",
            d: "Students",
            dk: "student_desc",
            dd: "Find schools, agents, and tutors you can trust",
           },
           {
            k: "role_tutor",
            d: "Tutors",
            dk: "tutor_desc",
            dd: "Support students globally and grow your practice",
           },
          ] as const
         ).map((x) => (
          <div
           key={x.k}
           className="rounded-3xl bg-white/92 p-4 text-slate-900 text-left shadow-[0_18px_50px_rgba(0,0,0,0.20)]"
          >
           <div className="text-lg font-extrabold">{tr(lang, x.k, x.d)}</div>
           <div className="mt-1 text-xs text-slate-600">
            {tr(lang, x.dk, x.dd)}
           </div>
          </div>
         ))}
        </div>

        {/* Bottom trust bullets */}
        <div className="mt-10 w-full text-white/95">
         <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-10 gap-y-4">
          <div className="flex items-center gap-3">
           <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
            <svg
             viewBox="0 0 24 24"
             className="h-5 w-5"
             fill="none"
             stroke="currentColor"
             strokeWidth="2"
             strokeLinecap="round"
             strokeLinejoin="round"
             aria-hidden="true"
            >
             <path d="M12 2l7 4v6c0 5-3 9-7 10-4-1-7-5-7-10V6l7-4z" />
             <path d="M9 12l2 2 4-4" />
            </svg>
           </span>
           <span className="text-lg font-semibold leading-tight">
            {tr(lang, "trust_verified", "✔ Verified profiles")
             .replace("✔", "")
             .trim()}
           </span>
          </div>

          <div className="flex items-center gap-3">
           <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
            <svg
             viewBox="0 0 24 24"
             className="h-5 w-5"
             fill="none"
             stroke="currentColor"
             strokeWidth="2"
             strokeLinecap="round"
             strokeLinejoin="round"
             aria-hidden="true"
            >
             <path d="M12 6a3 3 0 103 3" />
             <path d="M12 21a9 9 0 110-18 9 9 0 010 18z" />
             <path d="M7.5 12h9" />
             <path d="M12 7.5v9" />
            </svg>
           </span>
           <span className="text-lg font-semibold leading-tight">
            {tr(lang, "trust_transparent", "✔ Transparent partnerships")
             .replace("✔", "")
             .trim()}
           </span>
          </div>

          <div className="flex items-center gap-3">
           <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
            <svg
             viewBox="0 0 24 24"
             className="h-5 w-5"
             fill="none"
             stroke="currentColor"
             strokeWidth="2"
             strokeLinecap="round"
             strokeLinejoin="round"
             aria-hidden="true"
            >
             <path d="M12 3v18" />
             <path d="M7 8l5-5 5 5" />
             <path d="M7 16l5 5 5-5" />
            </svg>
           </span>
           <span className="text-lg font-semibold leading-tight">
            {tr(lang, "trust_no_hidden", "✔ No hidden agendas")
             .replace("✔", "")
             .trim()}
           </span>
          </div>
         </div>
        </div>

        <p className="mt-8 text-center text-sm font-semibold text-white/85">
         {t.one_platform}
        </p>
       </div>
      </div>
     </section>

     {/* Right auth card */}
     <section className="lg:sticky lg:top-6 justify-self-end w-full text-gray-900">
      <div className="w-full max-w-[560px]">
       <div
        id="auth-card"
        className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6 lg:p-7 shadow-lg"
       >
        <div className="flex items-center justify-between">
         <div>
          <div className="text-lg font-semibold">
           {authView === "forgot"
            ? t.reset_title
            : mode === "signin"
             ? t.login_title
             : t.signup_title}
          </div>
          <div className="text-sm text-gray-500">
           {authView === "forgot"
            ? t.reset_sub
            : mode === "signin"
             ? t.welcome_back
             : t.signup_journey}
          </div>
         </div>
         <img
          src="https://firebasestorage.googleapis.com/v0/b/greenpass-dc92d.firebasestorage.app/o/rawdatas%2FGreenPass%20Official.png?alt=media&token=809da08b-22f6-4049-bbbf-9b82342630e8"
          alt="GreenPass"
          className="h-14 w-14 rounded-2xl object-cover"
          loading="lazy"
         />
        </div>

        {/* Tabs (hidden on Forgot Password view) */}
        {authView === "auth" && (
         <div className="mt-5 grid grid-cols-2 rounded-2xl bg-gray-100 p-1">
          <button
           onClick={() => {
            setMode("signin");
            setAuthView("auth");
            setMsg(null);
           }}
           className={`rounded-xl px-3 py-2 text-sm font-semibold ${
            mode === "signin" ? "bg-white shadow-sm" : "text-gray-600"
           }`}
          >
           {t.signin}
          </button>
          <button
           onClick={() => {
            setMode("signup");
            setAuthView("auth");
            setMsg(null);
           }}
           className={`rounded-xl px-3 py-2 text-sm font-semibold ${
            mode === "signup" ? "bg-white shadow-sm" : "text-gray-600"
           }`}
          >
           {t.signup}
          </button>
         </div>
        )}

        {/* Role dropdown */}
        {authView === "auth" && mode === "signup" && (
         <div className="mt-5">
          <label className="mb-1 block text-xs font-semibold text-gray-600">
           {t.choose_role}
          </label>

          <select
            value={role}
            onChange={(e) => setRole(e.target.value as RoleValue)}
            disabled={busy || inviteRoleLoading || hasInvite}
            className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="" disabled>
              {t.select_role}
            </option>

            {ROLE_ITEMS.map((r) => (
              <option key={r.value} value={r.value}>
                {tr(lang, r.key, r.def)}
              </option>
            ))}
          </select>
         </div>
        )}

        {/* Social */}
        {authView === "auth" && (
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

          <div className="my-5 flex items-center gap-3">
           <div className="h-px flex-1 bg-gray-200" />
           <div className="text-xs text-gray-500">{t.or}</div>
           <div className="h-px flex-1 bg-gray-200" />
          </div>
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

         {authView === "auth" && (
          <div>
           <label className="mb-1 block text-xs font-semibold text-gray-600">
            {t.password}
           </label>
           <div className="relative">
            <input
             value={password}
             onChange={(e) => setPassword(e.target.value)}
             placeholder={t.password_ph}
             type={showPassword ? "text" : "password"}
             className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-3 pr-12 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
             autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />

            <button
             type="button"
             onClick={() => setShowPassword((v) => !v)}
             className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-600 hover:text-gray-900"
             aria-label={showPassword ? "Hide password" : "Show password"}
            >
             {showPassword ? (
              <EyeOffIcon className="h-4 w-4" />
             ) : (
              <EyeIcon className="h-4 w-4" />
             )}
            </button>
           </div>

           {mode === "signin" && (
            <div className="mt-2 text-right">
             <button
              type="button"
              onClick={() => {
               setAuthView("forgot");
               setMsg(null);
              }}
              className="text-xs font-semibold text-blue-600 hover:underline"
             >
              {t.forgot_pw}
             </button>
            </div>
           )}
          </div>
         )}

         {authView === "auth" && mode === "signup" && (
          <div>
           <label className="mb-1 block text-xs font-semibold text-gray-600">
            {t.confirm}
           </label>
           <div className="relative">
            <input
             value={confirm}
             onChange={(e) => setConfirm(e.target.value)}
             placeholder={t.confirm_ph}
             type={showConfirm ? "text" : "password"}
             className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-3 pr-12 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
             autoComplete="new-password"
            />

            <button
             type="button"
             onClick={() => setShowConfirm((v) => !v)}
             className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-600 hover:text-gray-900"
             aria-label={showConfirm ? "Hide password" : "Show password"}
            >
             {showConfirm ? (
              <EyeOffIcon className="h-4 w-4" />
             ) : (
              <EyeIcon className="h-4 w-4" />
             )}
            </button>
           </div>
          </div>
         )}
        </div>

        {msg && (
         <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {msg}
         </div>
        )}

        {authView === "auth" ? (
         <button
          onClick={handleEmailAuth}
          disabled={!canSubmit || busy}
          className="mt-5 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
         >
          {busy ? t.loading : mode === "signin" ? t.cta_login : t.cta_signup}
         </button>
        ) : (
         <div className="mt-5 space-y-2">
          <button
           onClick={handleSendReset}
           disabled={!email || busy}
           className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
          >
           {busy ? t.loading : t.send_reset}
          </button>
          <button
           type="button"
           onClick={() => {
            setAuthView("auth");
            setMode("signin");
            setMsg(null);
           }}
           className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-60"
          >
           {t.back_to_login}
          </button>
         </div>
        )}

        <p className="mt-4 text-center text-xs text-gray-500">
         {t.after_login}
        </p>
       </div>

       {authView === "auth" && (
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
       )}
      </div>
     </section>
    </div>

    <div className="mt-auto pt-6">
     <LanguageFooter
      value={lang}
      onChange={(code) => {
       const normalized = normalizeLang(String(code));
       setLang(normalized);
       setLangEverywhere(normalized);
      }}
     />
    </div>
   </main>
  </div>
 );
}
