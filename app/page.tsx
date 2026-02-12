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
   "GreenPass is your all-in-one platform for international students. Connect with verified schools, agents, tutors, jobs, and immigration support in one place.",

  hero_h1_1: "The Global Marketplace Connecting",
  hero_h1_2: "Schools, Agents, Tutors & Students",
  hero_tagline: "Study, work, and immigration pathways. Connected transparently in one trusted platform.",
  promo_title: "Build Your Global Education & Career Network with GreenPass",
  promo_body: "GreenPass is a trusted marketplace where schools connect with verified agents, agents support students, tutors provide academic guidance, and everyone grows together transparently and efficiently.",
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

  // Tutor / Student cards (kept consistent across languages)
  tutor_desc: "Support students globally and grow your practice",
  tutor_b1: "Find students internationally",
  tutor_b2: "Offer academic and pathway support",
  tutor_b3: "Build your professional profile",
  student_desc: "Find schools, agents, and tutors you can trust",
  student_b1: "Discover verified schools and programs",
  student_b2: "Connect with reliable agents and tutors",
  student_b3: "Get guided step by step transparently",
},

 // The languages below match your LanguageFooter options.
 // If a key is missing, it will safely fall back to English.
 vi: {
  hero_line1: "Du học. Làm việc quốc tế.",
  hero_line2: "Xây dựng tương lai cùng GreenPass.",
  hero_sub:
   "GreenPass là nền tảng tất cả-trong-một dành cho du học sinh kết nối với trường đã xác minh, tư vấn viên, gia sư, việc làm và hỗ trợ di trú tại một nơi.",

  hero_h1_1: "Thị trường toàn cầu kết nối",
  hero_h1_2: "Trường học, Tư vấn viên, Gia sư & Học sinh",
  hero_tagline: "Du học, việc làm và lộ trình di trú kết nối minh bạch trên một nền tảng đáng tin cậy.",
  promo_title: "Xây dựng mạng lưới giáo dục & sự nghiệp toàn cầu cùng GreenPass",
  promo_body: "GreenPass là nền tảng đáng tin cậy nơi trường học kết nối với tư vấn viên đã xác minh, tư vấn viên hỗ trợ học sinh, gia sư hướng dẫn học tập, và mọi người cùng phát triển minh bạch và hiệu quả.",
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
  weak_pw: "weak_pw",

  // Tutor / Student cards (kept consistent across languages)
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
  hero_line1: "Mag-aral abroad. Magtrabaho abroad.",
  hero_line2: "Buoin ang future mo with GreenPass.",
  hero_sub:
   "GreenPass ang all-in-one platform para sa international students kumonekta sa verified schools, agents, tutors, jobs, at immigration support sa iisang lugar.",

  hero_h1_1: "Ang Global Marketplace na Nag-uugnay",
  hero_h1_2: "Mga Paaralan, Ahente, Tutor at Estudyante",
  hero_tagline: "Mga landas para sa pag‑aaral, trabaho, at imigrasyon malinaw na konektado sa iisang mapagkakatiwalaang platform.",
  promo_title: "Buuin ang iyong Global Education at Career Network kasama ang GreenPass",
  promo_body: "Ang GreenPass ay isang mapagkakatiwalaang marketplace kung saan nagkakaugnay ang mga paaralan at beripikadong ahente, tinutulungan ng mga ahente ang mga estudyante, nagbibigay ng gabay ang mga tutor, at sabay‑sabay na umuunlad malinaw at episyente.",
  trust_verified: "✔ Beripikadong profile",
  trust_transparent: "✔ Transparent na pakikipag‑ugnayan",
  trust_no_hidden: "✔ Walang nakatagong intensyon",
  promo_cta_join: "Sumali sa GreenPass — Magsimulang kumonekta ngayon",
  promo_cta_signin: "Mag‑sign in",
  card1_title: "Verified Schools",
  card1_sub: "Hanapin ang trusted institutions.",
  card2_title: "One App. One Journey.",
  card2_sub: "Study • Work • Immigration support iisang place.",
  card3_title: "Tutors & Agents",
  card3_sub: "Step-by-step na guidance.",
 
  agent_b1: "Access sa verified schools at programs",
  agent_b2: "I-track ang leads at cases nang malinaw",
  agent_b3: "Bumuo ng long-term na partnership",
  agent_desc: "Direktang trabaho sa tunay na schools walang middle layers",
  apple: "Magpatuloy gamit ang Apple",
  choose_role: "Pumili ng role",
  confirm: "Kumpirmahin ang password",
  confirm_ph: "Kumpirmahin ang password",
  cta_login: "Mag-log in",
  cta_signup: "Gumawa ng account",
  email: "Email",
  email_in_use: "Gamit na ang email.",
  email_ph: "Email address",
  google: "Magpatuloy gamit ang Google",
  have_account: "May account ka na?",
  invalid_creds: "Maling email o password.",
  join_agent: "Sumali bilang Agent",
  join_school: "Sumali bilang School",
  join_student: "Sumali bilang Student",
  join_tutor: "Sumali bilang Tutor",
  loading: "Sandali…",
  login_title: "Mag-log in",
  no_account: "Wala pang account?",
  or: "O",
  password: "Password",
  password_ph: "Password",
  pw_mismatch: "Hindi magkapareho ang password.",
  role_agent: "Agent",
  role_required: "Pumili muna ng role.",
  role_school: "School",
  role_student: "Student",
  role_tutor: "Tutor",
  school_b1: "Abutin ang verified agents worldwide",
  school_b2: "I-manage ang recruitment nang malinaw",
  school_b3: "Bawasan ang marketing at admission costs",
  school_desc: "Kumonekta sa trusted agents at students sa buong mundo",
  select_role: "Pumili ng role…",
  signin: "Mag-sign in",
  signup: "Mag-sign up",
  signup_title: "Gumawa ng account",
  weak_pw: "weak_pw",

  // Tutor / Student cards (kept consistent across languages)
  tutor_desc: "Suportahan ang mga estudyante sa buong mundo at palaguin ang iyong serbisyo",
  tutor_b1: "Maghanap ng mga estudyante sa ibang bansa",
  tutor_b2: "Magbigay ng tulong sa akademiko at mga pathway",
  tutor_b3: "Buuin ang iyong propesyonal na profile",
  student_desc: "Maghanap ng mga paaralan, ahente, at tutor na mapagkakatiwalaan",
  student_b1: "Tuklasin ang mga beripikadong paaralan at programa",
  student_b2: "Kumonekta sa maaasahang mga ahente at tutor",
  student_b3: "Gabayan nang hakbang-hakbang nang malinaw",
},

 ceb: {
  hero_line1: "Mag-eskwela sa abroad. Mag-trabaho sa abroad.",
  hero_line2: "Tukora ang imong kaugmaon sa GreenPass.",
  hero_sub:
   "GreenPass kay all-in-one platform para sa international students konekta sa verified schools, agents, tutors, trabaho, ug immigration support sa usa ka lugar.",

  hero_h1_1: "Ang Global Marketplace nga Nagkonektar",
  hero_h1_2: "Mga Eskwelahan, Ahente, Tutor ug Estudyante",
  hero_tagline: "Mga dalan para sa pagtuon, trabaho, ug imigrasyon klaro ug tin-aw nga konektado sa usa ka kasaligan nga plataporma.",
  promo_title: "Tukora ang imong Global Education ug Career Network uban ang GreenPass",
  promo_body: "Ang GreenPass usa ka kasaligan nga marketplace diin ang mga eskwelahan mokonektar sa verified nga mga ahente, ang mga ahente motabang sa mga estudyante, ang mga tutor mohatag og giya, ug tanan motubo nga mag-uban tin-aw ug episyente.",
  trust_verified: "✔ Verified nga mga profile",
  trust_transparent: "✔ Transparent nga pakig‑partner",
  trust_no_hidden: "✔ Walay tinago nga tuyo",
  promo_cta_join: "Apil sa GreenPass. Sugdi ang koneksyon karon",
  promo_cta_signin: "Mo‑sign in",
  card1_title: "Verified Schools",
  card1_sub: "Pangitaa ang kasaligan nga mga eskwelahan.",
  card2_title: "One App. One Journey.",
  card2_sub: "Study • Work • Immigration supportsa usa ka lugar.",
  card3_title: "Tutors & Agents",
  card3_sub: "Gi-guide ka step-by-step.",
 
  agent_b1: "Access sa verified schools ug programs",
  agent_b2: "I-track ang leads ug cases nga klaro",
  agent_b3: "Tukora ang long-term nga partnership",
  agent_desc: "Diretso nga trabaho sa tinuod nga schools walay tunga",
  apple: "Padayon gamit ang Apple",
  choose_role: "Pilia ang role",
  confirm: "Kumpirmaha ang password",
  confirm_ph: "Kumpirmaha ang password",
  cta_login: "Log in",
  cta_signup: "Himoa ang account",
  email: "Email",
  email_in_use: "Gigamit na ang email.",
  email_ph: "Email address",
  google: "Padayon gamit ang Google",
  have_account: "Naa kay account?",
  invalid_creds: "Sayop nga email o password.",
  join_agent: "Apil isip Agent",
  join_school: "Apil isip School",
  join_student: "Apil isip Student",
  join_tutor: "Apil isip Tutor",
  loading: "Kadiyot…",
  login_title: "Log in",
  no_account: "Wala pay account?",
  or: "O",
  password: "Password",
  password_ph: "Password",
  pw_mismatch: "Dili magkapareho ang password.",
  role_agent: "Agent",
  role_required: "Palihog pili ug role.",
  role_school: "School",
  role_student: "Student",
  role_tutor: "Tutor",
  school_b1: "Maabot ang verified agents sa tibuok kalibutan",
  school_b2: "Dumala sa recruitment nga klaro",
  school_b3: "Pamenosi ang marketing ug admission costs",
  school_desc: "Konektahi ang kasaligan nga agents ug students sa tibuok kalibutan",
  select_role: "Pilia ang role…",
  signin: "Sign in",
  signup: "Sign up",
  signup_title: "Himoa ang account",
  weak_pw: "weak_pw",

  // Tutor / Student cards (kept consistent across languages)
  tutor_desc: "Tabangi ang mga estudyante sa tibuok kalibutan ug palambu-a ang imong praktis",
  tutor_b1: "Pangitaa ang mga estudyante sa internasyonal",
  tutor_b2: "Ihatag ang akademiko ug pathway nga suporta",
  tutor_b3: "Tukora ang imong propesyonal nga profile",
  student_desc: "Pangitaa ang mga eskwelahan, ahente, ug tutor nga kasaligan",
  student_b1: "Ila ang beripikado nga mga eskwelahan ug programa",
  student_b2: "Konektahi ang kasaligan nga mga ahente ug tutor",
  student_b3: "Giya sa matag lakang nga klaro",
},

 es: {
  hero_line1: "Estudia en el extranjero. Trabaja en el extranjero.",
  hero_line2: "Construye tu futuro con GreenPass.",
  hero_sub:
   "GreenPass es tu plataforma todo-en-uno para estudiantes internacionales: conecta con escuelas verificadas, agentes, tutores, empleos y apoyo migratorio en un solo lugar.",

  hero_h1_1: "El mercado global que conecta",
  hero_h1_2: "Escuelas, Agentes, Tutores y Estudiantes",
  hero_tagline: "Estudio, trabajo y vías de inmigración. Conectados de forma transparente en una plataforma de confianza.",
  promo_title: "Construye tu red global de educación y carrera con GreenPass",
  promo_body: "GreenPass es un marketplace de confianza donde las escuelas se conectan con agentes verificados, los agentes apoyan a los estudiantes, los tutores brindan orientación académica y todos crecen juntos de forma transparente y eficiente.",
  trust_verified: "✔ Perfiles verificados",
  trust_transparent: "✔ Alianzas transparentes",
  trust_no_hidden: "✔ Sin agendas ocultas",
  promo_cta_join: "Únete a GreenPass. Empieza a conectar hoy",
  promo_cta_signin: "Iniciar sesión",
  card1_title: "Escuelas verificadas",
  card1_sub: "Descubre instituciones confiables.",
  card2_title: "Una app. Un camino.",
  card2_sub: "Estudio • Trabajo • Migración en un solo lugar.",
  card3_title: "Tutores y agentes",
  card3_sub: "Guía paso a paso.",
 
  agent_b1: "Accede a escuelas y programas verificados",
  agent_b2: "Sigue leads y casos con claridad",
  agent_b3: "Construye alianzas de largo plazo",
  agent_desc: "Trabaja directo con escuelas reales sin intermediarios",
  apple: "Continuar con Apple",
  choose_role: "Elegir rol",
  confirm: "Confirmar contraseña",
  confirm_ph: "Confirmar contraseña",
  cta_login: "Iniciar sesión",
  cta_signup: "Crear cuenta",
  email: "Correo",
  email_in_use: "El correo ya está en uso.",
  email_ph: "Dirección de correo",
  google: "Continuar con Google",
  have_account: "¿Ya tienes una cuenta?",
  invalid_creds: "Correo o contraseña inválidos.",
  join_agent: "Unirse como Agente",
  join_school: "Unirse como Escuela",
  join_student: "Unirse como Estudiante",
  join_tutor: "Unirse como Tutor",
  loading: "Espera…",
  login_title: "Iniciar sesión",
  no_account: "¿No tienes una cuenta?",
  or: "O",
  password: "Contraseña",
  password_ph: "Contraseña",
  pw_mismatch: "Las contraseñas no coinciden.",
  role_agent: "Agente",
  role_required: "Por favor, selecciona un rol.",
  role_school: "Escuela",
  role_student: "Estudiante",
  role_tutor: "Tutor",
  school_b1: "Llega a agentes verificados en todo el mundo",
  school_b2: "Gestiona el reclutamiento con transparencia",
  school_b3: "Reduce costos de marketing y admisión",
  school_desc: "Conéctate con agentes y estudiantes de confianza en todo el mundo",
  select_role: "Selecciona un rol…",
  signin: "Iniciar sesión",
  signup: "Registrarse",
  signup_title: "Crear cuenta",
  weak_pw: "weak_pw",

  // Tutor / Student cards (kept consistent across languages)
  tutor_desc: "Apoya a estudiantes en todo el mundo y haz crecer tu práctica",
  tutor_b1: "Encuentra estudiantes internacionalmente",
  tutor_b2: "Ofrece apoyo académico y de rutas educativas",
  tutor_b3: "Construye tu perfil profesional",
  student_desc: "Encuentra escuelas, agentes y tutores en los que puedas confiar",
  student_b1: "Descubre escuelas y programas verificados",
  student_b2: "Conecta con agentes y tutores confiables",
  student_b3: "Recibe guía paso a paso de forma transparente",
},

 ja: {
  hero_line1: "海外で学ぶ。海外で働く。",
  hero_line2: "GreenPassで未来をつくろう。",
  hero_sub:
   "GreenPassは留学生向けのオールインワンプラットフォーム。認証済みの学校、エージェント、講師、仕事、移民サポートを一つに。",

  hero_h1_1: "世界をつなぐグローバル・マーケットプレイス",
  hero_h1_2: "学校・エージェント・チューター・学生",
  hero_tagline: "留学・就労・移民の道筋を、信頼できる一つのプラットフォームで透明に接続します。",
  promo_title: "GreenPassで世界の教育・キャリアネットワークを築こう",
  promo_body: "GreenPassは、学校が認証済みエージェントとつながり、エージェントが学生を支援し、チューターが学習面をサポートする、信頼できるマーケットプレイスです。透明性と効率性を大切にしながら、みんなで成長できます。",
  trust_verified: "✔ 認証済みプロフィール",
  trust_transparent: "✔ 透明なパートナーシップ",
  trust_no_hidden: "✔ 隠れた思惑なし",
  promo_cta_join: "GreenPassに参加 — 今日からつながろう",
  promo_cta_signin: "サインイン",
  card1_title: "認証済み学校",
  card1_sub: "信頼できる学校を探す。",
  card2_title: "1つのアプリ。1つの旅。",
  card2_sub: "学ぶ • 働く • 移民サポート まとめて。",
  card3_title: "講師 & エージェント",
  card3_sub: "ステップごとにサポート。",
 
  agent_b1: "認証済み学校・プログラムにアクセス",
  agent_b2: "リードや案件を分かりやすく追跡",
  agent_b3: "長期的な信頼関係を構築",
  agent_desc: "実在の学校と直接連携（中間なし）",
  apple: "Appleで続行",
  choose_role: "役割を選択",
  confirm: "パスワード確認",
  confirm_ph: "パスワード確認",
  cta_login: "ログイン",
  cta_signup: "アカウント作成",
  email: "メール",
  email_in_use: "このメールは既に使用されています。",
  email_ph: "メールアドレス",
  google: "Googleで続行",
  have_account: "アカウントをお持ちですか？",
  invalid_creds: "メールまたはパスワードが無効です。",
  join_agent: "エージェントとして参加",
  join_school: "学校として参加",
  join_student: "学生として参加",
  join_tutor: "チューターとして参加",
  loading: "お待ちください…",
  login_title: "ログイン",
  no_account: "アカウントがありませんか？",
  or: "または",
  password: "パスワード",
  password_ph: "パスワード",
  pw_mismatch: "パスワードが一致しません。",
  role_agent: "エージェント",
  role_required: "役割を選択してください。",
  role_school: "学校",
  role_student: "学生",
  role_tutor: "チューター",
  school_b1: "世界中の認証エージェントにリーチ",
  school_b2: "募集状況を透明に管理",
  school_b3: "マーケ・入学コストを削減",
  school_desc: "信頼できるエージェントと学生とつながる",
  select_role: "役割を選択…",
  signin: "サインイン",
  signup: "サインアップ",
  signup_title: "アカウント作成",
  weak_pw: "weak_pw",

  // Tutor / Student cards (kept consistent across languages)
  tutor_desc: "世界中の学生を支援し、あなたの活動を広げましょう",
  tutor_b1: "海外の学生を見つける",
  tutor_b2: "学習・進路のサポートを提供する",
  tutor_b3: "プロフェッショナルプロフィールを作成する",
  student_desc: "信頼できる学校・エージェント・講師を見つけよう",
  student_b1: "認証済みの学校とプログラムを探す",
  student_b2: "信頼できるエージェントや講師とつながる",
  student_b3: "透明性のあるステップ別ガイドを受ける",
},

 ko: {
  hero_line1: "해외 유학. 해외 취업.",
  hero_line2: "GreenPass로 미래를 준비하세요.",
  hero_sub:
   "GreenPass는 유학생을 위한 올인원 플랫폼입니다 — 검증된 학교, 에이전트, 튜터, 일자리, 이민 지원을 한 곳에서 연결하세요.",

  hero_h1_1: "전 세계를 연결하는 글로벌 마켓플레이스",
  hero_h1_2: "학교, 에이전트, 튜터 및 학생",
  hero_tagline: "유학, 취업, 이민 경로를 신뢰할 수 있는 하나의 플랫폼에서 투명하게 연결합니다.",
  promo_title: "GreenPass로 글로벌 교육·커리어 네트워크를 구축하세요",
  promo_body: "GreenPass는 학교가 검증된 에이전트와 연결되고, 에이전트가 학생을 지원하며, 튜터가 학업 지도를 제공하는 신뢰할 수 있는 마켓플레이스입니다. 투명하고 효율적으로 함께 성장합니다.",
  trust_verified: "✔ 검증된 프로필",
  trust_transparent: "✔ 투명한 파트너십",
  trust_no_hidden: "✔ 숨겨진 의도 없음",
  promo_cta_join: "GreenPass 가입 — 오늘 바로 연결하세요",
  promo_cta_signin: "로그인",
  card1_title: "검증된 학교",
  card1_sub: "신뢰할 수 있는 기관을 찾아보세요.",
  card2_title: "하나의 앱. 하나의 여정.",
  card2_sub: "학업 • 취업 • 이민 지원 — 한 곳에서.",
  card3_title: "튜터 & 에이전트",
  card3_sub: "단계별로 안내합니다.",
 
  agent_b1: "검증된 학교 및 프로그램 접근",
  agent_b2: "리드와 케이스를 명확히 추적",
  agent_b3: "장기적인 신뢰 파트너십 구축",
  agent_desc: "실제 학교와 직접 협업 — 중간 단계 없음",
  apple: "Apple로 계속",
  choose_role: "역할 선택",
  confirm: "비밀번호 확인",
  confirm_ph: "비밀번호 확인",
  cta_login: "로그인",
  cta_signup: "계정 만들기",
  email: "이메일",
  email_in_use: "이미 사용 중인 이메일입니다.",
  email_ph: "이메일 주소",
  google: "Google로 계속",
  have_account: "계정이 있나요?",
  invalid_creds: "이메일 또는 비밀번호가 올바르지 않습니다.",
  join_agent: "에이전트로 가입",
  join_school: "학교로 가입",
  join_student: "학생으로 가입",
  join_tutor: "튜터로 가입",
  loading: "잠시만요…",
  login_title: "로그인",
  no_account: "계정이 없나요?",
  or: "또는",
  password: "비밀번호",
  password_ph: "비밀번호",
  pw_mismatch: "비밀번호가 일치하지 않습니다.",
  role_agent: "에이전트",
  role_required: "역할을 선택하세요.",
  role_school: "학교",
  role_student: "학생",
  role_tutor: "튜터",
  school_b1: "전 세계 검증된 에이전트에 도달",
  school_b2: "모집을 투명하게 관리",
  school_b3: "마케팅/입학 비용 절감",
  school_desc: "전 세계의 신뢰할 수 있는 에이전트와 학생을 연결하세요",
  select_role: "역할 선택…",
  signin: "로그인",
  signup: "회원가입",
  signup_title: "계정 만들기",
  weak_pw: "weak_pw",

  // Tutor / Student cards (kept consistent across languages)
  tutor_desc: "전 세계 학생을 지원하고 활동을 성장시키세요",
  tutor_b1: "해외 학생 찾기",
  tutor_b2: "학업 및 진로 지원 제공",
  tutor_b3: "전문 프로필 구축",
  student_desc: "신뢰할 수 있는 학교, 에이전트, 튜터를 찾아보세요",
  student_b1: "검증된 학교 및 프로그램 탐색",
  student_b2: "신뢰할 수 있는 에이전트와 튜터와 연결",
  student_b3: "투명하게 단계별 안내 받기",
},

 zh: {
  hero_line1: "出国留学。海外工作。",
  hero_line2: "用 GreenPass 规划你的未来。",
  hero_sub:
   "GreenPass 是面向国际学生的一站式平台——在一个地方连接已验证的学校、顾问/中介、导师、工作机会与移民支持。",

  hero_h1_1: "连接世界的全球平台",
  hero_h1_2: "学校、代理、导师与学生",
  hero_tagline: "留学、工作与移民路径——在一个可信平台上透明连接。",
  promo_title: "用 GreenPass 构建你的全球教育与职业网络",
  promo_body: "GreenPass 是一个可信的市场平台：学校与已验证的代理连接，代理支持学生，导师提供学业指导，大家在透明高效的环境中共同成长。",
  trust_verified: "✔ 已验证资料",
  trust_transparent: "✔ 透明合作",
  trust_no_hidden: "✔ 无隐藏目的",
  promo_cta_join: "加入 GreenPass——立即开始连接",
  promo_cta_signin: "登录",
  card1_title: "已验证院校",
  card1_sub: "发现可信机构。",
  card2_title: "一个应用，一个旅程。",
  card2_sub: "学习 • 工作 • 移民支持 一站式。",
  card3_title: "导师与顾问",
  card3_sub: "一步一步带你走。",
 
  agent_b1: "访问已验证学校与项目",
  agent_b2: "清晰跟踪线索与案件",
  agent_b3: "建立长期可信合作",
  agent_desc: "直接与真实学校合作 无中间层",
  apple: "使用 Apple 继续",
  choose_role: "选择角色",
  confirm: "确认密码",
  confirm_ph: "确认密码",
  cta_login: "登录",
  cta_signup: "创建账户",
  email: "邮箱",
  email_in_use: "该邮箱已被使用。",
  email_ph: "邮箱地址",
  google: "使用 Google 继续",
  have_account: "已有账户？",
  invalid_creds: "邮箱或密码无效。",
  join_agent: "以代理身份加入",
  join_school: "以学校身份加入",
  join_student: "以学生身份加入",
  join_tutor: "以导师身份加入",
  loading: "请稍候…",
  login_title: "登录",
  no_account: "没有账户？",
  or: "或",
  password: "密码",
  password_ph: "密码",
  pw_mismatch: "两次密码不一致。",
  role_agent: "代理",
  role_required: "请选择角色。",
  role_school: "学校",
  role_student: "学生",
  role_tutor: "导师",
  school_b1: "触达全球已验证代理",
  school_b2: "透明管理招生与合作",
  school_b3: "降低营销与招生成本",
  school_desc: "连接全球可信代理与学生",
  select_role: "选择一个角色…",
  signin: "登录",
  signup: "注册",
  signup_title: "创建账户",
  weak_pw: "weak_pw",

  // Tutor / Student cards (kept consistent across languages)
  tutor_desc: "支持全球学生，发展你的辅导业务",
  tutor_b1: "寻找国际学生",
  tutor_b2: "提供学术与升学路径支持",
  tutor_b3: "打造你的专业档案",
  student_desc: "找到值得信赖的学校、顾问和导师",
  student_b1: "发现已验证的学校与课程项目",
  student_b2: "联系可靠的顾问与导师",
  student_b3: "获得清晰透明的分步指导",
},

 ar: {
  hero_line1: "ادرس في الخارج. اعمل في الخارج.",
  hero_line2: "ابنِ مستقبلك مع GreenPass.",
  hero_sub:
   "GreenPass منصة متكاملة للطلاب الدوليين — تواصل مع مدارس ووكلاء ومدرّسين وفرص عمل ودعم للهجرة في مكان واحد.",

  hero_h1_1: "السوق العالمي الذي يربط",
  hero_h1_2: "المدارس والوكلاء والمعلمون والطلاب",
  hero_tagline: "مسارات الدراسة والعمل والهجرة — متصلة بشفافية على منصة واحدة موثوقة.",
  promo_title: "ابنِ شبكة تعليم ومسار مهني عالمية مع GreenPass",
  promo_body: "GreenPass منصة موثوقة تربط المدارس بوكلاء مُتحقَّق منهم، ويدعم الوكلاء الطلاب، ويقدّم المدرسون إرشادًا أكاديميًا، وينمو الجميع معًا — بشفافية وكفاءة.",
  trust_verified: "✔ ملفات مُتحقَّق منها",
  trust_transparent: "✔ شراكات شفافة",
  trust_no_hidden: "✔ بلا أجندات خفية",
  promo_cta_join: "انضم إلى GreenPass — ابدأ التواصل اليوم",
  promo_cta_signin: "تسجيل الدخول",
  card1_title: "مدارس موثّقة",
  card1_sub: "اكتشف مؤسسات موثوقة.",
  card2_title: "تطبيق واحد. رحلة واحدة.",
  card2_sub: "دراسة • عمل • دعم للهجرة — في مكان واحد.",
  card3_title: "مدرّسون ووكلاء",
  card3_sub: "إرشاد خطوة بخطوة.",
 
  agent_b1: "الوصول إلى مدارس وبرامج موثَّقة",
  agent_b2: "تتبع العملاء والحالات بوضوح",
  agent_b3: "بناء شراكات طويلة المدى",
  agent_desc: "اعمل مباشرة مع مدارس حقيقية — بدون وسطاء",
  apple: "المتابعة باستخدام Apple",
  choose_role: "اختر الدور",
  confirm: "تأكيد كلمة المرور",
  confirm_ph: "تأكيد كلمة المرور",
  cta_login: "تسجيل الدخول",
  cta_signup: "إنشاء حساب",
  email: "البريد الإلكتروني",
  email_in_use: "البريد الإلكتروني مستخدم بالفعل.",
  email_ph: "عنوان البريد الإلكتروني",
  google: "المتابعة باستخدام Google",
  have_account: "لديك حساب؟",
  invalid_creds: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  join_agent: "انضم كوكيل",
  join_school: "انضم كمدرسة",
  join_student: "انضم كطالب",
  join_tutor: "انضم كمدرّس",
  loading: "يرجى الانتظار…",
  login_title: "تسجيل الدخول",
  no_account: "ليس لديك حساب؟",
  or: "أو",
  password: "كلمة المرور",
  password_ph: "كلمة المرور",
  pw_mismatch: "كلمتا المرور غير متطابقتين.",
  role_agent: "وكيل",
  role_required: "يرجى اختيار الدور.",
  role_school: "مدرسة",
  role_student: "طالب",
  role_tutor: "مدرّس خصوصي",
  school_b1: "الوصول إلى وكلاء موثَّقين عالميًا",
  school_b2: "إدارة التوظيف/الاستقطاب بشفافية",
  school_b3: "تقليل تكاليف التسويق والقبول",
  school_desc: "تواصل مع وكلاء وطلاب موثوقين حول العالم",
  select_role: "اختر دورًا…",
  signin: "تسجيل الدخول",
  signup: "إنشاء حساب",
  signup_title: "إنشاء حساب",
  weak_pw: "weak_pw",

  // Tutor / Student cards (kept consistent across languages)
  tutor_desc: "ادعم الطلاب حول العالم وطوّر عملك",
  tutor_b1: "اعثر على طلاب دوليًا",
  tutor_b2: "قدّم دعمًا أكاديميًا ودعمًا لمسارات الدراسة",
  tutor_b3: "ابنِ ملفك المهني",
  student_desc: "اعثر على مدارس ووكلاء ومدرّسين موثوقين",
  student_b1: "اكتشف المدارس والبرامج الموثوقة",
  student_b2: "تواصل مع وكلاء ومدرّسين موثوقين",
  student_b3: "احصل على إرشاد خطوة بخطوة بشفافية",
},

 "pt-BR": {
  hero_line1: "Estude no exterior. Trabalhe no exterior.",
  hero_line2: "Construa seu futuro com a GreenPass.",
  hero_sub:
   "A GreenPass é a plataforma tudo-em-um para estudantes internacionais conecte-se com escolas verificadas, agentes, tutores, vagas e suporte de imigração em um só lugar.",
  card1_title: "Escolas verificadas",
  card1_sub: "Descubra instituições confiáveis.",
  card2_title: "Um app. Uma jornada.",
  card2_sub: "Estudo • Trabalho • Imigração em um só lugar.",
  card3_title: "Tutores e agentes",
  card3_sub: "Orientação passo a passo.",
 
  agent_b1: "Acesse escolas e programas verificados",
  agent_b2: "Acompanhe leads e casos com clareza",
  agent_b3: "Construa parcerias de longo prazo",
  agent_desc: "Trabalhe direto com escolas reais sem intermediários",
  apple: "Continuar com Apple",
  choose_role: "Escolher perfil",
  confirm: "Confirmar senha",
  confirm_ph: "Confirmar senha",
  cta_login: "Entrar",
  cta_signup: "Criar conta",
  email: "Email",
  email_in_use: "O email já está em uso.",
  email_ph: "Endereço de email",
  google: "Continuar com Google",
  have_account: "Já tem conta?",
  invalid_creds: "Email ou senha inválidos.",
  join_agent: "Entrar como Agente",
  join_school: "Entrar como Escola",
  join_student: "Entrar como Estudante",
  join_tutor: "Entrar como Tutor",
  loading: "Aguarde…",
  login_title: "Entrar",
  no_account: "Não tem conta?",
  or: "OU",
  password: "Senha",
  password_ph: "Senha",
  pw_mismatch: "As senhas não coincidem.",
  role_agent: "Agente",
  role_required: "Selecione um perfil.",
  role_school: "Escola",
  role_student: "Estudante",
  role_tutor: "Tutor",
  school_b1: "Alcance agentes verificados no mundo todo",
  school_b2: "Gerencie o recrutamento com transparência",
  school_b3: "Reduza custos de marketing e admissão",
  school_desc: "Conecte-se com agentes e alunos confiáveis no mundo todo",
  select_role: "Selecione um perfil…",
  signin: "Entrar",
  signup: "Cadastrar",
  signup_title: "Criar conta",
  weak_pw: "weak_pw",
},

 fr: {
  hero_line1: "Étudie à l’étranger. Travaille à l’étranger.",
  hero_line2: "Construis ton avenir avec GreenPass.",
  hero_sub:
   "GreenPass est une plateforme tout-en-un pour les étudiants internationaux écoles vérifiées, agents, tuteurs, emplois et soutien à l’immigration, au même endroit.",

  hero_h1_1: "La place de marché mondiale qui connecte",
  hero_h1_2: "Écoles, Agents, Tuteurs & Étudiants",
  hero_tagline: "Études, travail et parcours d’immigration connectés en toute transparence sur une plateforme de confiance.",
  promo_title: "Construisez votre réseau mondial d’éducation et de carrière avec GreenPass",
  promo_body: "GreenPass est une place de marché de confiance où les écoles se connectent à des agents vérifiés, les agents accompagnent les étudiants, les tuteurs apportent un soutien académique, et chacun progresse en toute transparence et efficacement.",
  trust_verified: "✔ Profils vérifiés",
  trust_transparent: "✔ Partenariats transparents",
  trust_no_hidden: "✔ Aucune arrière‑pensée",
  promo_cta_join: "Rejoignez GreenPass Commencez à vous connecter dès aujourd’hui",
  promo_cta_signin: "Se connecter",
  card1_title: "Écoles vérifiées",
  card1_sub: "Découvre des institutions fiables.",
  card2_title: "Une app. Un parcours.",
  card2_sub: "Études • Travail • Immigration au même endroit.",
  card3_title: "Tuteurs & agents",
  card3_sub: "Guidé pas à pas.",
 
  agent_b1: "Accédez aux écoles et programmes vérifiés",
  agent_b2: "Suivez leads et dossiers clairement",
  agent_b3: "Construisez des partenariats durables",
  agent_desc: "Travaillez directement avec de vraies écoles sans intermédiaires",
  apple: "Continuer avec Apple",
  choose_role: "Choisir un rôle",
  confirm: "Confirmer le mot de passe",
  confirm_ph: "Confirmer le mot de passe",
  cta_login: "Se connecter",
  cta_signup: "Créer un compte",
  email: "Email",
  email_in_use: "Cet email est déjà utilisé.",
  email_ph: "Adresse email",
  google: "Continuer avec Google",
  have_account: "Vous avez un compte ?",
  invalid_creds: "Email ou mot de passe invalide.",
  join_agent: "Rejoindre en tant qu’agent",
  join_school: "Rejoindre en tant qu’école",
  join_student: "Rejoindre en tant qu’étudiant",
  join_tutor: "Rejoindre en tant que tuteur",
  loading: "Veuillez patienter…",
  login_title: "Connexion",
  no_account: "Vous n’avez pas de compte ?",
  or: "OU",
  password: "Mot de passe",
  password_ph: "Mot de passe",
  pw_mismatch: "Les mots de passe ne correspondent pas.",
  role_agent: "Agent",
  role_required: "Veuillez sélectionner un rôle.",
  role_school: "École",
  role_student: "Étudiant",
  role_tutor: "Tuteur",
  school_b1: "Atteignez des agents vérifiés partout",
  school_b2: "Gérez le recrutement en toute transparence",
  school_b3: "Réduisez les coûts marketing et d’admission",
  school_desc: "Connectez-vous avec des agents et des étudiants de confiance dans le monde",
  select_role: "Sélectionnez un rôle…",
  signin: "Se connecter",
  signup: "S’inscrire",
  signup_title: "Créer un compte",
  weak_pw: "weak_pw",

  // Tutor / Student cards (kept consistent across languages)
  tutor_desc: "Soutenez des étudiants dans le monde entier et développez votre activité",
  tutor_b1: "Trouvez des étudiants à l’international",
  tutor_b2: "Offrez un accompagnement académique et d’orientation",
  tutor_b3: "Construisez votre profil professionnel",
  student_desc: "Trouvez des écoles, des agents et des tuteurs de confiance",
  student_b1: "Découvrez des écoles et programmes vérifiés",
  student_b2: "Connectez-vous avec des agents et tuteurs fiables",
  student_b3: "Soyez guidé pas à pas, en toute transparence",
},

 de: {
  hero_line1: "Im Ausland studieren. Im Ausland arbeiten.",
  hero_line2: "Baue deine Zukunft mit GreenPass.",
  hero_sub:
   "GreenPass ist deine All-in-One-Plattform für internationale Studierende verbinde dich mit verifizierten Schulen, Agenten, Tutoren, Jobs und Einwanderungs-Support an einem Ort.",

  hero_h1_1: "Der globale Marktplatz, der verbindet",
  hero_h1_2: "Schulen, Agenten, Tutoren & Studierende",
  hero_tagline: "Studium, Arbeit und Einwanderungswege — transparent verbunden auf einer vertrauenswürdigen Plattform.",
  promo_title: "Bauen Sie Ihr globales Bildungs- & Karrierenetzwerk mit GreenPass auf",
  promo_body: "GreenPass ist ein vertrauenswürdiger Marktplatz, auf dem Schulen mit verifizierten Agenten zusammenkommen, Agenten Studierende unterstützen, Tutoren akademische Begleitung bieten und alle gemeinsam wachsen transparent und effizient.",
  trust_verified: "✔ Verifizierte Profile",
  trust_transparent: "✔ Transparente Partnerschaften",
  trust_no_hidden: "✔ Keine versteckten Absichten",
  promo_cta_join: "Treten Sie GreenPass bei. Starten Sie noch heute",
  promo_cta_signin: "Anmelden",
  card1_title: "Verifizierte Schulen",
  card1_sub: "Entdecke vertrauenswürdige Einrichtungen.",
  card2_title: "Eine App. Eine Reise.",
  card2_sub: "Studium • Arbeit • Immigration an einem Ort.",
  card3_title: "Tutoren & Agenten",
  card3_sub: "Schritt-für-Schritt-Begleitung.",
 
  agent_b1: "Verifizierte Schulen und Programme ansehen",
  agent_b2: "Leads und Fälle klar nachverfolgen",
  agent_b3: "Langfristige Partnerschaften aufbauen",
  agent_desc: "Direkt mit echten Schulen arbeiten ohne Zwischenstufen",
  apple: "Mit Apple fortfahren",
  choose_role: "Rolle wählen",
  confirm: "Passwort bestätigen",
  confirm_ph: "Passwort bestätigen",
  cta_login: "Anmelden",
  cta_signup: "Konto erstellen",
  email: "E-Mail",
  email_in_use: "E-Mail wird bereits verwendet.",
  email_ph: "E-Mail-Adresse",
  google: "Mit Google fortfahren",
  have_account: "Schon ein Konto?",
  invalid_creds: "Ungültige E-Mail oder Passwort.",
  join_agent: "Als Agent beitreten",
  join_school: "Als Schule beitreten",
  join_student: "Als Student beitreten",
  join_tutor: "Als Tutor beitreten",
  loading: "Bitte warten…",
  login_title: "Anmelden",
  no_account: "Noch kein Konto?",
  or: "ODER",
  password: "Passwort",
  password_ph: "Passwort",
  pw_mismatch: "Passwörter stimmen nicht überein.",
  role_agent: "Agent",
  role_required: "Bitte wähle eine Rolle.",
  role_school: "Schule",
  role_student: "Student",
  role_tutor: "Tutor",
  school_b1: "Verifizierte Agenten weltweit erreichen",
  school_b2: "Recruiting transparent verwalten",
  school_b3: "Marketing- und Zulassungskosten senken",
  school_desc: "Verbinde dich mit vertrauenswürdigen Agenten und Studierenden weltweit",
  select_role: "Rolle auswählen…",
  signin: "Anmelden",
  signup: "Registrieren",
  signup_title: "Konto erstellen",
  weak_pw: "weak_pw",

  // Tutor / Student cards (kept consistent across languages)
  tutor_desc: "Unterstütze Lernende weltweit und baue deine Tätigkeit aus",
  tutor_b1: "Finde internationale Lernende",
  tutor_b2: "Biete akademische und Karrierepfad‑Unterstützung",
  tutor_b3: "Baue dein professionelles Profil auf",
  student_desc: "Finde Schulen, Agenten und Tutor:innen, denen du vertrauen kannst",
  student_b1: "Entdecke verifizierte Schulen und Programme",
  student_b2: "Vernetze dich mit zuverlässigen Agenten und Tutor:innen",
  student_b3: "Erhalte transparente Schritt‑für‑Schritt‑Begleitung",
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
  return {   signin: tr(lang, "signin"),
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

 

 return (
  <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900">
   <Navbar
    lang={lang}
    onLangChange={(code) => {
     setLang(code);
     setLangEverywhere(code);
    }}
   />

   <main className="w-full flex-1 min-h-0 overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-800 px-2 sm:px-4 lg:px-6 pt-4 pb-4 lg:pt-4 lg:pb-4">
    <div className="grid flex-1 min-h-0 grid-cols-1 items-center gap-8 lg:gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(320px,520px)] xl:grid-cols-[minmax(0,1fr)_minmax(360px,560px)]">
     <section className="lg:pr-6 xl:pr-10">
      <div className="relative overflow-hidden rounded-[44px] border border-white/15 bg-white/10 p-4 sm:p-6 lg:p-7 shadow-[0_22px_90px_rgba(0,0,0,0.35)] backdrop-blur">
       {/* soft glow */}
       <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(900px_circle_at_15%_20%,rgba(255,255,255,0.22),transparent_55%),radial-gradient(900px_circle_at_85%_30%,rgba(16,185,129,0.18),transparent_55%),radial-gradient(900px_circle_at_60%_90%,rgba(255,255,255,0.10),transparent_55%)]" />
       <div className="relative">

        {/* Headline */}
        <h1 className="mt-2 text-center text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
         <span className="block">{tr(lang, "hero_h1_1", "The Global Marketplace Connecting")}</span>
         <span className="block">
          {tr(lang, "hero_h1_2", "Schools, Agents, Tutors & Students")}
         </span>
        </h1>

        {/* Tagline */}
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
         {/* orbit + arrows */}
         <svg
          className="absolute inset-0 z-0 h-full w-full opacity-70"
          viewBox="0 0 1000 640"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
         >
          <defs>
           {/* Colorful gradients to match the poster */}
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

           {/* Arrowhead markers */}
           {/* Arrowhead markers (auto-rotate with the path tangent) */}
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
  <path d="M0 0 L12 6 L0 12 Z" fill="rgba(16,185,129,0.95)" />
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
  <path d="M0 0 L12 6 L0 12 Z" fill="rgba(59,130,246,0.95)" />
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
  <path d="M0 0 L12 6 L0 12 Z" fill="rgba(124,58,237,0.95)" />
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
  <path d="M0 0 L12 6 L0 12 Z" fill="rgba(245,158,11,0.95)" />
</marker>



          </defs>
          <circle cx="500" cy="320" r="120" stroke="rgba(255,255,255,0.28)" strokeWidth="3" strokeDasharray="2 10" />
          <circle cx="500" cy="320" r="170" stroke="rgba(255,255,255,0.16)" strokeWidth="2" strokeDasharray="3 14" />
          {/* arrows (card-to-card, like the poster) */}
{/* arrows (cycle ring) — ONE perfect circle split into 4 segments */}
{/* Center is (500,320). Radius 180. Clockwise loop. */}
{/* Segment 1: School -> Agent (top) */}
<path
  d="M372.7 192.7 A180 180 0 0 1 627.3 192.7"
  stroke="url(#gpAmber)"
  strokeWidth="12"
  strokeLinecap="round"
  opacity="0.9"
  markerEnd="url(#arrowAmber)"
/>

{/* Segment 2: Agent -> Tutor (right) */}
<path
  d="M627.3 192.7 A180 180 0 0 1 627.3 447.3"
  stroke="url(#gpBlue)"
  strokeWidth="12"
  strokeLinecap="round"
  opacity="0.9"
  markerEnd="url(#arrowBlue)"
/>

{/* Segment 3: Tutor -> Student (bottom) */}
<path
  d="M627.3 447.3 A180 180 0 0 1 372.7 447.3"
  stroke="url(#gpPurple)"
  strokeWidth="12"
  strokeLinecap="round"
  opacity="0.9"
  markerEnd="url(#arrowPurple)"
/>

{/* Segment 4: Student -> School (left) */}
<path
  d="M372.7 447.3 A180 180 0 0 1 372.7 192.7"
  stroke="url(#gpGreen)"
  strokeWidth="12"
  strokeLinecap="round"
  opacity="0.9"
  markerEnd="url(#arrowGreen)"
/>



         </svg>

         {/* Center GP */}
         <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-white/95 shadow-[0_14px_50px_rgba(0,0,0,0.25)]">
           <div className="absolute inset-[-10px] rounded-full border-2 border-white/30" />
           <span className="text-2xl font-extrabold text-emerald-700">GP</span>
          </div>
         </div>

         {/* Cards */}
         <div className="absolute left-0 top-3 z-10 w-[40%] px-2">
          <div className="rounded-3xl bg-white/92 p-4 text-slate-900 text-left shadow-[0_18px_50px_rgba(0,0,0,0.20)]">
           {/* Illustration */}
           <div className="mb-3 flex items-center justify-center">
            <img src="/role-images/role_school.png" alt="" className="h-20 w-full max-w-[92%] object-contain" loading="lazy" />
           </div>
           
           <div className="text-lg font-extrabold">{tr(lang, "role_school", "School")}</div>
           <div className="mt-1 text-xs text-slate-600">{tr(lang, "school_desc", "Connect with trusted global agents and students")}</div>
           <ul className="mt-2 space-y-1 text-xs text-slate-700">
            <li className="flex items-start gap-2"><span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">✓</span>{tr(lang, "school_b1", "Reach verified agents worldwide")}</li>
            <li className="flex items-start gap-2"><span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">✓</span>{tr(lang, "school_b2", "Manage recruitment transparently")}</li>
            <li className="flex items-start gap-2"><span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">✓</span>{tr(lang, "school_b3", "Reduce marketing and admission costs")}</li>
           </ul>
          </div>
         </div>

         <div className="absolute right-0 top-3 z-10 w-[40%] px-2">
          <div className="rounded-3xl bg-white/92 p-4 text-slate-900 text-left shadow-[0_18px_50px_rgba(0,0,0,0.20)]">
           {/* Illustration */}
           <div className="mb-3 flex items-center justify-center">
            <img src="/role-images/role_agent.png" alt="" className="h-20 w-full max-w-[92%] object-contain" loading="lazy" />
           </div>
           
           <div className="text-lg font-extrabold">{tr(lang, "role_agent", "Agent")}</div>
           <div className="mt-1 text-xs text-slate-600">{tr(lang, "agent_desc", "Work directly with real schools — no middle layers")}</div>
           <ul className="mt-2 space-y-1 text-xs text-slate-700">
            <li className="flex items-start gap-2"><span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-blue-700">✓</span>{tr(lang, "agent_b1", "Access verified schools and programs")}</li>
            <li className="flex items-start gap-2"><span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-blue-700">✓</span>{tr(lang, "agent_b2", "Track applications clearly")}</li>
            <li className="flex items-start gap-2"><span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-blue-700">✓</span>{tr(lang, "agent_b3", "Build long-term, trusted partnerships")}</li>
           </ul>
          </div>
         </div>

         <div className="absolute left-0 bottom-3 z-10 w-[40%] px-2">
          <div className="rounded-3xl bg-white/92 p-4 text-slate-900 text-left shadow-[0_18px_50px_rgba(0,0,0,0.20)]">
           {/* Illustration */}
           <div className="mb-3 flex items-center justify-center">
            <img src="/role-images/role_student.png" alt="" className="h-20 w-full max-w-[92%] object-contain" loading="lazy" />
           </div>
           
           <div className="text-lg font-extrabold">{tr(lang, "role_student", "Students")}</div>
           <div className="mt-1 text-xs text-slate-600">{tr(lang, "student_desc", "Find schools, agents, and tutors you can trust")}</div>
           <ul className="mt-2 space-y-1 text-xs text-slate-700">
            <li className="flex items-start gap-2">
             <span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-violet-100 text-violet-700 ring-1 ring-violet-200">✓</span>
             {tr(lang, "student_b1", "Discover verified schools and programs")}
            </li>
            <li className="flex items-start gap-2">
             <span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-violet-100 text-violet-700 ring-1 ring-violet-200">✓</span>
             {tr(lang, "student_b2", "Connect with reliable agents and tutors")}
            </li>
            <li className="flex items-start gap-2">
             <span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-violet-100 text-violet-700 ring-1 ring-violet-200">✓</span>
             {tr(lang, "student_b3", "Get guided step by step transparently")}
            </li>
           </ul>
          </div>
         </div>

         <div className="absolute right-0 bottom-3 z-10 w-[40%] px-2">
          <div className="rounded-3xl bg-white/92 p-4 text-slate-900 text-left shadow-[0_18px_50px_rgba(0,0,0,0.20)]">
           {/* Illustration */}
           <div className="mb-3 flex items-center justify-center">
            <img src="/role-images/role_tutor.jpg" alt="" className="h-20 w-full max-w-[92%] object-contain" loading="lazy" />
           </div>
           
           <div className="text-lg font-extrabold">{tr(lang, "role_tutor", "Tutors")}</div>
           <div className="mt-1 text-xs text-slate-600">{tr(lang, "tutor_desc", "Support students globally and grow your practice")}</div>
           <ul className="mt-2 space-y-1 text-xs text-slate-700">
            <li className="flex items-start gap-2"><span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 text-amber-700">✓</span>{tr(lang, "tutor_b1", "Find students internationally")}</li>
            <li className="flex items-start gap-2"><span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 text-amber-700">✓</span>{tr(lang, "tutor_b2", "Offer academic and pathway support")}</li>
            <li className="flex items-start gap-2"><span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 text-amber-700">✓</span>{tr(lang, "tutor_b3", "Build your professional profile")}</li>
           </ul>
          </div>
         </div>
          </div>
         </div>
        </div>

        {/* Mobile cards */}
        <div className="mt-8 grid grid-cols-1 gap-4 md:hidden">
         <div className="rounded-3xl bg-white/92 p-4 text-slate-900 text-left shadow-[0_18px_50px_rgba(0,0,0,0.20)]">
          <div className="text-lg font-extrabold">{tr(lang, "role_school", "School")}</div>
          <div className="mt-1 text-xs text-slate-600">{tr(lang, "school_desc", "Connect with trusted global agents and students")}</div>
         </div>
         <div className="rounded-3xl bg-white/92 p-4 text-slate-900 text-left shadow-[0_18px_50px_rgba(0,0,0,0.20)]">
          <div className="text-lg font-extrabold">{tr(lang, "role_agent", "Agent")}</div>
          <div className="mt-1 text-xs text-slate-600">{tr(lang, "agent_desc", "Work directly with real schools — no middle layers")}</div>
         </div>
         <div className="rounded-3xl bg-white/92 p-4 text-slate-900 text-left shadow-[0_18px_50px_rgba(0,0,0,0.20)]">
          <div className="text-lg font-extrabold">{tr(lang, "role_student", "Students")}</div>
          <div className="mt-1 text-xs text-slate-600">{tr(lang, "student_desc", "Find schools, agents, and tutors you can trust")}</div>
         </div>
         <div className="rounded-3xl bg-white/92 p-4 text-slate-900 text-left shadow-[0_18px_50px_rgba(0,0,0,0.20)]">
          <div className="text-lg font-extrabold">{tr(lang, "role_tutor", "Tutors")}</div>
          <div className="mt-1 text-xs text-slate-600">{tr(lang, "tutor_desc", "Support students globally and grow your practice")}</div>
         </div>
        </div>

        
        {/* Bottom trust bullets (poster style) */}
        <div className="mt-10 w-full text-white/95">
         <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-10 gap-y-4">
          <div className="flex items-center gap-3">
           <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
             <path d="M12 2l7 4v6c0 5-3 9-7 10-4-1-7-5-7-10V6l7-4z" />
             <path d="M9 12l2 2 4-4" />
            </svg>
           </span>
           <span className="text-lg font-semibold leading-tight">
            {tr(lang, "trust_verified", "✔ Verified profiles").replace("✔", "").trim()}
           </span>
          </div>

          <div className="flex items-center gap-3">
           <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
             <path d="M12 6a3 3 0 103 3" />
             <path d="M12 21a9 9 0 110-18 9 9 0 010 18z" />
             <path d="M7.5 12h9" />
             <path d="M12 7.5v9" />
            </svg>
           </span>
           <span className="text-lg font-semibold leading-tight">
            {tr(lang, "trust_transparent", "✔ Transparent partnerships").replace("✔", "").trim()}
           </span>
          </div>

          <div className="flex items-center gap-3">
           <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
             <path d="M12 3v18" />
             <path d="M7 8l5-5 5 5" />
             <path d="M7 16l5 5 5-5" />
            </svg>
           </span>
           <span className="text-lg font-semibold leading-tight">
            {tr(lang, "trust_no_hidden", "✔ No hidden agendas").replace("✔", "").trim()}
           </span>
          </div>
         </div>
        </div>


        {/* Closing line */}
        <p className="mt-8 text-center text-sm font-semibold text-white/85">
         One platform. One journey. Real connections that matter.
        </p>
       </div>
      </div>
     </section>

     {/* Right auth card (LIGHT) */}
     <section className="lg:sticky lg:top-6 justify-self-end w-full text-gray-900">
      <div className="w-full max-w-[560px]">
       <div id="auth-card" className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6 lg:p-7 shadow-lg ">
        <div className="flex items-center justify-between">
         <div>
          <div className="text-lg font-semibold">
           {mode === "signin" ? t.login_title : t.signup_title}
          </div>
          <div className="text-sm text-gray-500">
           {mode === "signin" ? "Welcome back." : "Sign up to start your journey"}
          </div>
         </div>
         <img src="https://firebasestorage.googleapis.com/v0/b/greenpass-dc92d.firebasestorage.app/o/rawdatas%2FGreenPass%20Official.png?alt=media&token=809da08b-22f6-4049-bbbf-9b82342630e8" alt="GreenPass" className="h-14 w-14 rounded-2xl object-cover" loading="lazy" />
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

        {/* Role dropdown (NATIVE <select> — behaves like a real dropdown) */}
        {mode === "signup" && (
         <div className="mb-4">
          <label className="mb-1 block text-xs font-semibold text-gray-600">
           {t.choose_role}
          </label>

          <select
           value={role}
           onChange={(e) => setRole(e.target.value as RoleValue)}
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

    <div className="mt-auto pt-6">
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