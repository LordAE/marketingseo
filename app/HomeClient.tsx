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
import { HOME_TX, trHome } from "./lib/i18n/home";

import { auth, db } from "./lib/firebase";
import {
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
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
  const idToken = await user.getIdToken();

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
  const idToken = await user.getIdToken();

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

/** Public preview of referral agent from QR token */
async function getAgentReferralPublic(ref: string) {
  const r = await fetch(
    `${FUNCTIONS_BASE.replace(/\/+$/, "")}/getAgentReferralPublic?ref=${encodeURIComponent(ref)}`,
    { method: "GET" }
  );

  if (!r.ok) {
    const msg = await r.text().catch(() => "");
    throw new Error(msg || "Invalid referral");
  }

  return r.json().catch(() => ({} as any));
}

/** Accept agent referral for signed-in student */
async function acceptAgentReferral(user: User, ref: string) {
  const idToken = await user.getIdToken();

  const r = await fetch(
    `${FUNCTIONS_BASE.replace(/\/+$/, "")}/acceptAgentReferral`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ ref }),
    }
  );

  if (!r.ok) {
    const msg = await r.text().catch(() => "");
    throw new Error(msg || "Failed to accept referral");
  }

  return r.json().catch(() => ({} as any));
}

type RoleValue = "student" | "agent" | "tutor" | "school" | "collaborator";

const ROLE_ITEMS: { value: Exclude<RoleValue, "collaborator">; key: string; def: string }[] = [
  { value: "student", key: "role_student", def: "Student" },
  { value: "agent", key: "role_agent", def: "Agent" },
  { value: "tutor", key: "role_tutor", def: "Tutor" },
  { value: "school", key: "role_school", def: "School" },
];

const tr = trHome;

function normalizeUserRole(data: any): string {
  return String(
    data?.selected_role ||
      data?.user_type ||
      data?.userType ||
      data?.role ||
      ""
  )
    .toLowerCase()
    .trim();
}

function buildCollaboratorReferralFields(refCode = "", referredByUid = "") {
  const code = String(refCode || "").trim();
  if (!code) return {};

  return {
    referred_by_collaborator_code: code,
    referred_by_collaborator_uid: referredByUid || "",
    referred_by_collaborator_at: serverTimestamp(),
  };
}

async function resolveCollaboratorRef(refCode: string) {
  const code = String(refCode || "").trim();
  if (!code) return "";

  try {
    const { collection, getDocs, limit, query, where } = await import("firebase/firestore");

    const q = query(
      collection(db, "users"),
      where("collaborator_referral_code", "==", code),
      limit(1)
    );

    const snap = await getDocs(q);
    if (snap.empty) return "";
    return snap.docs[0]?.id || "";
  } catch (error) {
    console.error("resolveCollaboratorRef error:", error);
    return "";
  }
}

async function ensureUserDoc(
  user: User,
  role?: RoleValue,
  options?: {
    collaboratorRef?: string;
    referredByCollaboratorUid?: string;
    signupEntryRole?: RoleValue;
  }
) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  const chosen = role;
  const collaboratorRef = options?.collaboratorRef || "";
  const referredByCollaboratorUid = options?.referredByCollaboratorUid || "";
  const signupEntryRole = options?.signupEntryRole || chosen;

  if (!snap.exists()) {
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

    if (signupEntryRole) {
      base.signup_entry_role = signupEntryRole;
    }

    Object.assign(
      base,
      buildCollaboratorReferralFields(collaboratorRef, referredByCollaboratorUid)
    );

    await setDoc(ref, base);
    return { exists: false, data: null as any };
  }

  const data = snap.data() || {};
  const patch: any = { updated_at: serverTimestamp() };

  if (chosen) {
    if (!data.selected_role) patch.selected_role = chosen;
    if (!data.user_type) patch.user_type = chosen;
    if (!data.userType) patch.userType = chosen;
    if (!data.role) patch.role = chosen;
  }

  if (signupEntryRole && !data.signup_entry_role) {
    patch.signup_entry_role = signupEntryRole;
  }

  if (collaboratorRef && !data.referred_by_collaborator_code) {
    Object.assign(
      patch,
      buildCollaboratorReferralFields(
        collaboratorRef,
        data?.referred_by_collaborator_uid || referredByCollaboratorUid
      )
    );
  }

  if (!data.onboarding_step) patch.onboarding_step = "basic_info";

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
  invite?: { inviteId: string; token: string },
  options?: {
    skipDocCheck?: boolean;
    collaboratorRef?: string;
    referredByCollaboratorUid?: string;
    signupEntryRole?: RoleValue;
  }
) {
  if (invite?.inviteId && invite?.token) {
    await acceptInvite(user, invite.inviteId, invite.token);
  }

  const safeNext = safeNextPath(nextFromUrl || "");
  const skipDocCheck =
    Boolean(options?.skipDocCheck) &&
    !invite?.inviteId &&
    !invite?.token &&
    !fallbackRole &&
    !options?.collaboratorRef;

  let next = safeNext || "/dashboard";

  if (!skipDocCheck) {
    const { exists, data } = await ensureUserDoc(user, fallbackRole, {
      collaboratorRef: options?.collaboratorRef,
      referredByCollaboratorUid: options?.referredByCollaboratorUid,
      signupEntryRole: options?.signupEntryRole || fallbackRole,
    });

    const onboardingCompleted = Boolean(data?.onboarding_completed);
    next =
      safeNext || (!exists || !onboardingCompleted ? "/onboarding" : "/dashboard");
  }

  const code = await createBridgeCode(user);
  const roleParam = fallbackRole ? `&role=${encodeURIComponent(fallbackRole)}` : "";

  window.location.href = appLink(
    `/auth-bridge?code=${encodeURIComponent(code)}&next=${encodeURIComponent(
      next
    )}${roleParam}`,
    lang
  );
}

/** Normalize lang codes from URL/browser/UI into the exact keys used in HOME_TX */
function normalizeLang(input: string): LangCode {
  const raw = (input || "").trim();
  if (!raw) return DEFAULT_LANG;

  const lower = raw.toLowerCase();
  if (lower === "jp" || lower.startsWith("ja")) return "ja" as LangCode;
  if (lower === "cn" || lower.startsWith("zh")) return "zh" as LangCode;
  if (lower === "pt" || lower.startsWith("pt-")) return "pt-BR" as LangCode;
  if (lower === "tl" || lower.startsWith("fil")) return "fil" as LangCode;

  if ((HOME_TX as any)[raw]) return raw as LangCode;
  if ((HOME_TX as any)[lower]) return lower as LangCode;

  return DEFAULT_LANG;
}

export default function HomeClient() {
  const params = useSearchParams();
  const urlLangRaw = params.get("lang") || "";
  const inviteId = params.get("invite") || "";
  const inviteToken = params.get("token") || "";
  const referralToken = params.get("ref") || "";
  const rawRoleParam = (params.get("role") || params.get("userType") || "").trim().toLowerCase();
  const collaboratorInviteFlow = rawRoleParam === "collaborator" && Boolean(referralToken);
  const rawNextFromUrl = params.get("next") || "";
  const nextFromUrl = safeNextPath(rawNextFromUrl);
  const logout = params.get("logout") === "1";
  const [logoutDone, setLogoutDone] = useState(!logout);
  const [booting, setBooting] = useState(true);

  const hasInvite = Boolean(inviteId && inviteToken);
  const roleLockedByReferral =
  Boolean(referralToken) && !hasInvite && !collaboratorInviteFlow;

  // auth UI state
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const invite = p.get("invite");
      const token = p.get("token");
      const ref = (p.get("ref") || "").trim();
      const rawRole = (p.get("role") || p.get("userType") || "").trim().toLowerCase();

      if (invite && token) {
        setMode("signup");
        return;
      }

      if (rawRole === "collaborator" && ref) {
        setMode("signup");
        setRole("collaborator");
        setAuthView("auth");
        setMsg(null);
        return;
      }

      if (ref) {
        setMode("signup");
        setRole("student");
        setAuthView("auth");
        setMsg(null);
      }
    } catch {}
  }, []);

  const [authView, setAuthView] = useState<"auth" | "forgot">("auth");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [fieldErr, setFieldErr] = useState<{
    email?: string;
    password?: string;
    confirm?: string;
    role?: string;
  }>({});

  useEffect(() => {
    setAuthView("auth");
  }, [mode]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [role, setRole] = useState<RoleValue | "">("");

  const [inviteRoleLoading, setInviteRoleLoading] = useState(false);

  const [referralLoading, setReferralLoading] = useState(false);
  const [referralPreview, setReferralPreview] = useState<any>(null);
  const [showReferralAccept, setShowReferralAccept] = useState(false);
  const [referredByCollaboratorUid, setReferredByCollaboratorUid] = useState("");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!hasInvite) return;

      setInviteRoleLoading(true);
      try {
        const base = FUNCTIONS_BASE.replace(/\/+$/, "");
        const url = `${base}/getInviteRolePublic?inviteId=${encodeURIComponent(
          inviteId
        )}&token=${encodeURIComponent(inviteToken)}`;
        const r = await fetch(url, { method: "GET" });
        const data = await r.json();

        if (cancelled) return;

        if (!data?.ok || !data?.role) {
          setMsg("Invalid or expired invite link.");
          return;
        }

        setRole(data.role as RoleValue);

        if (data.invitedEmail && typeof data.invitedEmail === "string") {
          setEmail(data.invitedEmail);
        }
      } catch {
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

    async function run() {
      if (!referralToken) return;

      if (!hasInvite) {
        setMode("signup");
        setRole("student");
        setAuthView("auth");
        setMsg(null);
      }

      try {
        setReferralLoading(true);
        const data = await getAgentReferralPublic(referralToken);
        if (!cancelled) {
          setReferralPreview(data);
        }
      } catch (e) {
        console.error("Referral preview failed:", e);
        if (!cancelled) {
          setMsg("Invalid or expired referral link.");
        }
      } finally {
        if (!cancelled) setReferralLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [referralToken, hasInvite]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!collaboratorInviteFlow || !referralToken) {
        if (!cancelled) setReferredByCollaboratorUid("");
        return;
      }

      const uid = await resolveCollaboratorRef(referralToken);
      if (!cancelled) {
        setReferredByCollaboratorUid(uid || "");
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [collaboratorInviteFlow, referralToken]);

  const [lang, setLang] = useState<LangCode>(DEFAULT_LANG);

  useEffect(() => {
    const initial = normalizeLang(urlLangRaw || resolveInitialLang());
    setLang(initial);
    setLangEverywhere(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!urlLangRaw) return;
    const normalized = normalizeLang(urlLangRaw);
    if (normalized !== lang) setLang(normalized);
  }, [urlLangRaw, lang]);

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
      pw_req_title: tr(lang, "pw_req_title"),
      pw_req_len: tr(lang, "pw_req_len"),
      pw_req_upper: tr(lang, "pw_req_upper"),
      pw_req_num: tr(lang, "pw_req_num"),
      pw_req_special: tr(lang, "pw_req_special"),
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

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!logout) {
        setLogoutDone(true);
        return;
      }

      setLogoutDone(false);

      try {
        await signOut(auth);
      } catch {}

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

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (logout && !logoutDone) return;

      try {
        await auth.authStateReady();

        if (cancelled) return;

        const user = auth.currentUser;
        if (user) {
          if (collaboratorInviteFlow) {
            await routeLikeWelcome(
              user,
              lang,
              "collaborator",
              nextFromUrl,
              hasInvite ? { inviteId, token: inviteToken } : undefined,
              {
                skipDocCheck: false,
                collaboratorRef: referralToken,
                referredByCollaboratorUid,
                signupEntryRole: "collaborator",
              }
            );
            return;
          }

          if (referralToken) {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);
            const userData = userSnap.exists() ? userSnap.data() || {} : {};
            const roleNow = normalizeUserRole(userData);

            if (roleNow === "student" || roleNow === "user") {
              if (!cancelled) {
                setShowReferralAccept(true);
                setBooting(false);
              }
              return;
            }
          }

          await routeLikeWelcome(
            user,
            lang,
            undefined,
            nextFromUrl,
            hasInvite ? { inviteId, token: inviteToken } : undefined,
            {
              skipDocCheck: !hasInvite,
            }
          );
          return;
        }
      } catch {
        // ignore and show landing page
      }

      if (!cancelled) {
        setBooting(false);
      }
    }

    boot();

    return () => {
      cancelled = true;
    };
  }, [
    lang,
    logout,
    logoutDone,
    hasInvite,
    inviteId,
    inviteToken,
    nextFromUrl,
    referralToken,
  ]);

  const pwChecks = useMemo(() => {
    const pw = password || "";
    return {
      length: pw.length >= 8,
      uppercase: /[A-Z]/.test(pw),
      number: /[0-9]/.test(pw),
      special: /[!@#$%^&*(),.?":{}|<>\[\]\\\/;'`~_+=\-]/.test(pw),
    };
  }, [password]);

  const pwValid = useMemo(() => {
    return (
      pwChecks.length &&
      pwChecks.uppercase &&
      pwChecks.number &&
      pwChecks.special
    );
  }, [pwChecks]);

  const canSubmit = useMemo(() => {
    if (!email || !password) return false;
    if (mode === "signup") {
      if (hasInvite) {
        if (inviteRoleLoading || !role) return false;
      } else if (collaboratorInviteFlow) {
        if (role !== "collaborator") return false;
      } else if (roleLockedByReferral) {
        if (role !== "student") return false;
      } else {
        if (!role) return false;
      }

      if (!pwValid) return false;
      if (password !== confirm) return false;
    }
    return true;
  }, [
    email,
    password,
    confirm,
    role,
    mode,
    hasInvite,
    inviteRoleLoading,
    pwValid,
    roleLockedByReferral,
  ]);

  function scrollToAuth() {
    if (typeof document === "undefined") return;
    document.getElementById("auth-card")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function pickRole(r: Exclude<RoleValue, "collaborator">) {
    if (collaboratorInviteFlow) return;

    setMode("signup");
    setRole(r);
    setAuthView("auth");
    setMsg(null);
    setTimeout(scrollToAuth, 50);
  }

  function isEmailLike(v: string) {
    const s = (v || "").trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

  function applyAuthError(e: any) {
    const code = String(e?.code || "");
    let message = t.generic_error;

    const setEmailErr = (m: string) => setFieldErr((p) => ({ ...p, email: m }));
    const setPwErr = (m: string) => setFieldErr((p) => ({ ...p, password: m }));

    if (code.includes("auth/invalid-email") || code.includes("auth/missing-email")) {
      message = tr(lang, "invalid_email", "Incorrect email.");
      setEmailErr(message);
    } else if (code.includes("auth/user-not-found")) {
      message = tr(lang, "user_not_found", "No account found for that email.");
      setEmailErr(message);
    } else if (
      code.includes("auth/wrong-password") ||
      code.includes("auth/invalid-credential") ||
      code.includes("auth/invalid-login-credentials")
    ) {
      message = tr(lang, "incorrect_password", "The password you entered is incorrect.");
      setPwErr(message);
    } else if (code.includes("auth/email-already-in-use")) {
      message = t.email_in_use;
      setEmailErr(message);
    } else if (code.includes("auth/weak-password")) {
      message = t.weak_pw;
      setPwErr(message);
    } else if (code.includes("auth/too-many-requests")) {
      message = tr(lang, "too_many_requests", "Too many attempts. Please try again later.");
    } else if (code.includes("auth/network-request-failed")) {
      message = tr(lang, "network_error", "Network error. Check your connection and try again.");
    } else if (code.includes("auth/popup-closed-by-user")) {
      message = tr(lang, "popup_closed", "Sign-in was cancelled.");
    }

    setMsg(message);
    return message;
  }

  async function handleAcceptReferralNow() {
    if (!auth.currentUser || !referralToken) return;

    try {
      setBusy(true);
      setMsg(null);

      await acceptAgentReferral(auth.currentUser, referralToken);

      await routeLikeWelcome(
        auth.currentUser,
        lang,
        undefined,
        nextFromUrl,
        hasInvite ? { inviteId, token: inviteToken } : undefined,
        { skipDocCheck: !hasInvite }
      );
    } catch (e: any) {
      console.error("Referral accept failed:", e);
      setMsg(e?.message || "Failed to accept referral.");
    } finally {
      setBusy(false);
    }
  }

  async function handleEmailAuth() {
    setMsg(null);
    setFieldErr({});

    const cleanEmail = (email || "").trim();
    if (!isEmailLike(cleanEmail)) {
      const m = tr(lang, "invalid_email", "Incorrect email.");
      setFieldErr({ email: m });
      setMsg(m);
      return;
    }

    try {
      setBusy(true);

      if (mode === "signin") {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);

        if (referralToken) {
          const userRef = doc(db, "users", cred.user.uid);
          const userSnap = await getDoc(userRef);
          const userData = userSnap.exists() ? userSnap.data() || {} : {};
          const roleNow = normalizeUserRole(userData);

          if (roleNow === "student" || roleNow === "user") {
            setShowReferralAccept(true);
            setBooting(false);
            return;
          }
        }

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
        if (!role) setFieldErr((p) => ({ ...p, role: t.role_required }));
        return;
      }

      if (collaboratorInviteFlow && role !== "collaborator") {
        setRole("collaborator");
      }

      if (roleLockedByReferral && role !== "student") {
        setRole("student");
      }

      if (!hasInvite && !collaboratorInviteFlow && !roleLockedByReferral && !role) {
        setFieldErr((p) => ({ ...p, role: t.role_required }));
        setMsg(t.role_required);
        return;
      }
      if (password !== confirm) {
        setFieldErr({ confirm: t.pw_mismatch });
        setMsg(t.pw_mismatch);
        return;
      }
      if (!pwValid) {
        setFieldErr({ password: t.weak_pw });
        setMsg(t.weak_pw);
        return;
      }

      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);

      if (collaboratorInviteFlow) {
        await ensureUserDoc(cred.user, "collaborator", {
          collaboratorRef: referralToken,
          referredByCollaboratorUid,
          signupEntryRole: "collaborator",
        });

        await routeLikeWelcome(
          cred.user,
          lang,
          "collaborator",
          nextFromUrl,
          hasInvite ? { inviteId, token: inviteToken } : undefined,
          {
            collaboratorRef: referralToken,
            referredByCollaboratorUid,
            signupEntryRole: "collaborator",
          }
        );
        return;
      }

      if (!hasInvite && role) {
        await ensureUserDoc(cred.user, role as RoleValue);
      }

      if (referralToken) {
        await acceptAgentReferral(cred.user, referralToken);
      }

      await routeLikeWelcome(
        cred.user,
        lang,
        !hasInvite && role ? (role as RoleValue) : undefined,
        nextFromUrl,
        hasInvite ? { inviteId, token: inviteToken } : undefined
      );
    } catch (e: any) {
      applyAuthError(e);
    } finally {
      setBusy(false);
    }
  }

  async function handleSendReset() {
    setMsg(null);
    setFieldErr({});

    const cleanEmail = (email || "").trim();
    if (!isEmailLike(cleanEmail)) {
      const m = tr(lang, "invalid_email", "Incorrect email.");
      setFieldErr({ email: m });
      setMsg(m);
      return;
    }
    try {
      setBusy(true);
      await sendPasswordResetEmail(auth, cleanEmail);
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

      const userRef = doc(db, "users", cred.user.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? userSnap.data() || {} : {};
      const roleNow = normalizeUserRole(userData);


      if (collaboratorInviteFlow) {
        await routeLikeWelcome(
          cred.user,
          lang,
          "collaborator",
          nextFromUrl,
          hasInvite ? { inviteId, token: inviteToken } : undefined,
          {
            collaboratorRef: referralToken,
            referredByCollaboratorUid,
            signupEntryRole: "collaborator",
          }
        );
        return;
      }

      if (referralToken && (roleNow === "student" || roleNow === "user")) {
        setShowReferralAccept(true);
        setBooting(false);
        return;
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
      if (code.includes("auth/")) {
        applyAuthError(e);
      } else {
        setMsg(t.google_fail);
      }
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

      const userRef = doc(db, "users", cred.user.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? userSnap.data() || {} : {};
      const roleNow = normalizeUserRole(userData);

      if (collaboratorInviteFlow) {
        await routeLikeWelcome(
          cred.user,
          lang,
          "collaborator",
          nextFromUrl,
          hasInvite ? { inviteId, token: inviteToken } : undefined,
          {
            collaboratorRef: referralToken,
            referredByCollaboratorUid,
            signupEntryRole: "collaborator",
          }
        );
        return;
      }

      if (referralToken && (roleNow === "student" || roleNow === "user")) {
        setShowReferralAccept(true);
        setBooting(false);
        return;
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
      if (code.includes("auth/")) {
        applyAuthError(e);
      } else {
        setMsg(t.apple_fail);
      }
    } finally {
      setBusy(false);
    }
  }

  if (booting && !(logout && !logoutDone)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-gray-700">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
          <div className="text-sm font-medium">Redirecting…</div>
        </div>
      </div>
    );
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

          {/* THIS SECTION NEEDS WORKING ON */}
          <section id='ONBOARD_INTRO' className="lg:pr-6 xl:pr-2">
            <div className="relative mx-auto w-full max-w-[1100px] overflow-hidden rounded-[36px] border border-white/15 bg-white/10 p-3 sm:p-4 lg:p-5 shadow-[0_22px_90px_rgba(0,0,0,0.35)] backdrop-blur">
              <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(900px_circle_at_15%_20%,rgba(255,255,255,0.22),transparent_55%),radial-gradient(900px_circle_at_85%_30%,rgba(16,185,129,0.18),transparent_55%),radial-gradient(900px_circle_at_60%_90%,rgba(255,255,255,0.10),transparent_55%)]" />
              <div className="relative">
                <h1 id="1st_TAGLINE" className="mt-2 text-center text-xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-3xl lg:text-4xl xl:text-[2.6rem]">
                  <span className="block">
                    {tr(lang, "hero_h1_1", "The Global Marketplace Connecting")}
                  </span>
                  <span className="block">
                    {tr(lang, "hero_h1_2", "Schools, Agents, Tutors & Students")}
                  </span>
                </h1>

                <p id="2nd_TAGLINE" className="mx-auto mt-2 max-w-2xl text-center text-sm leading-6 text-white/85 sm:text-base">
                  {tr(
                    lang,
                    "hero_tagline",
                    "Study, work, and immigration pathways. Connected transparently in one trusted platform."
                  )}
                </p>

                <div id="4_CONTAINERS_LARGE" className="relative my-12 hidden md:block h-[62vh] min-h-[460px] max-h-[600px] lg:max-h-[640px]">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div  className="relative h-[600px] w-[920px] origin-center scale-[0.72] lg:scale-[0.78] xl:scale-[0.9]">
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

                      <div className="absolute left-6 top-4 z-10 w-[44%] px-2">
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

                      <div className="absolute right-6 top-4 z-10 w-[44%] px-2">
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

                      <div className="absolute left-6 bottom-4 z-10 w-[44%] px-2">
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

                      <div className="absolute right-6 bottom-4 z-10 w-[44%] px-2">
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

                <div id="4_CONTAINERS_MEDIUM" className="mt-8 grid grid-cols-1 gap-4 md:hidden">
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

                <div id="PROLLY CIRCLE" className="mt-4 w-full text-white/95">
                  <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-3 gap-y-4">
                    <div className="flex items-center gap-2">
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

                    <div className="flex items-center gap-2">
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

                    <div className="flex items-center gap-2">
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

                <p id="BOTTOM_TEXT" className="mt-8 text-center text-sm font-semibold text-white/85">
                  {t.one_platform}
                </p>
              </div>
            </div>
          </section>

          <section id="login_ui" className="lg:sticky lg:top-6 justify-self-end w-full text-gray-900">
            <div className="w-full max-w-[560px]">
              {showReferralAccept && referralPreview ? (
                <div className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6 lg:p-7 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-semibold">Connect with agent</div>
                      <div className="text-sm text-gray-500">
                        Accept this referral to be added to the agent’s client list.
                      </div>
                    </div>
                    <img
                      src="https://firebasestorage.googleapis.com/v0/b/greenpass-dc92d.firebasestorage.app/o/rawdatas%2FGreenPass%20Official.png?alt=media&token=809da08b-22f6-4049-bbbf-9b82342630e8"
                      alt="GreenPass"
                      className="h-14 w-14 rounded-2xl object-cover"
                      loading="lazy"
                    />
                  </div>

                  <div className="mt-5 rounded-2xl border bg-gray-50 p-4">
                    <p className="text-xs font-semibold text-gray-500">Agent</p>
                    <p className="mt-1 text-base font-semibold text-gray-900">
                      {referralPreview?.agentName || "Agent"}
                    </p>
                    {referralPreview?.agentCompany ? (
                      <p className="mt-1 text-sm text-gray-600">
                        {referralPreview.agentCompany}
                      </p>
                    ) : null}
                  </div>

                  {referralLoading && (
                    <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                      Loading referral...
                    </div>
                  )}

                  {msg && (
                    <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {msg}
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleAcceptReferralNow}
                      disabled={busy}
                      className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
                    >
                      {busy ? t.loading : "Accept"}
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (auth.currentUser) {
                          routeLikeWelcome(
                            auth.currentUser,
                            lang,
                            undefined,
                            nextFromUrl,
                            hasInvite ? { inviteId, token: inviteToken } : undefined,
                            { skipDocCheck: !hasInvite }
                          );
                        }
                      }}
                      className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-60"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              ) : (
                <>
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

                    {authView === "auth" && (
                      <div className="mt-5 grid grid-cols-2 rounded-2xl bg-gray-100 p-1">
                        <button
                          onClick={() => {
                            if (collaboratorInviteFlow) return;
                            setMode("signin");
                            setAuthView("auth");
                            setMsg(null);
                          }}
                          className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                            mode === "signin" ? "bg-white shadow-sm" : "text-gray-600"
                          } ${collaboratorInviteFlow ? "cursor-not-allowed opacity-60" : ""}`}
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

                    {authView === "auth" && mode === "signup" && !roleLockedByReferral && !collaboratorInviteFlow && (
                      <div className="mt-5">
                        <label className="mb-1 block text-xs font-semibold text-gray-600">
                          {t.choose_role}
                        </label>

                        <select
                          value={role}
                          onChange={(e) => setRole(e.target.value as RoleValue)}
                          disabled={busy || inviteRoleLoading || hasInvite}
                          className={`w-full rounded-2xl border bg-white px-3 py-3 text-sm text-gray-900 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 ${
                            fieldErr.role
                              ? "border-red-400 focus:ring-red-400"
                              : "border-gray-300 focus:ring-emerald-500"
                          }`}
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
                        {fieldErr.role && (
                          <div className="mt-1 flex items-start gap-2 text-xs text-red-600">
                            <span className="mt-[2px] inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-100 text-red-700">
                              !
                            </span>
                            <span>{fieldErr.role}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {authView === "auth" && mode === "signup" && collaboratorInviteFlow && (
                      <div className="mt-5 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                        <div>
                          <div className="text-sm font-semibold text-emerald-800">
                            Collaborator
                          </div>
                          <div className="text-xs text-emerald-700">
                            This role was assigned through your invitation link.
                          </div>
                        </div>
                        <div className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                          Locked
                        </div>
                      </div>
                    )}
                    {authView === "auth" && mode === "signup" && roleLockedByReferral && (
                      <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-700 shadow-sm">
                        Signing up as: <strong>{tr(lang, "role_student", "Student")}</strong>
                      </div>
                    )}

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

                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-600">
                          {t.email}
                        </label>
                        <input
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder={t.email_ph}
                          className={`w-full rounded-2xl border bg-white px-3 py-3 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                            fieldErr.email
                              ? "border-red-400 focus:ring-red-400"
                              : "border-gray-300"
                          }`}
                          autoComplete="email"
                        />
                        {fieldErr.email && (
                          <div className="mt-1 flex items-start gap-2 text-xs text-red-600">
                            <span className="mt-[2px] inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-100 text-red-700">
                              !
                            </span>
                            <span>{fieldErr.email}</span>
                          </div>
                        )}
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
                              className={`w-full rounded-2xl border bg-white px-3 py-3 pr-12 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                                fieldErr.password
                                  ? "border-red-400 focus:ring-red-400"
                                  : "border-gray-300"
                              }`}
                              autoComplete={
                                mode === "signin" ? "current-password" : "new-password"
                              }
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

                          {fieldErr.password && (
                            <div className="mt-2 flex items-start gap-2 text-xs text-red-600">
                              <span className="mt-[2px] inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-100 text-red-700">
                                !
                              </span>
                              <span>{fieldErr.password}</span>
                            </div>
                          )}

                          {mode === "signup" && (
                            <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 text-xs">
                              <div className="mb-2 font-semibold text-gray-700">
                                {t.pw_req_title}
                              </div>

                              <div className="space-y-1">
                                <div className={pwChecks.length ? "text-emerald-700" : "text-gray-600"}>
                                  {pwChecks.length ? "✓" : "✕"} {t.pw_req_len}
                                </div>
                                <div className={pwChecks.uppercase ? "text-emerald-700" : "text-gray-600"}>
                                  {pwChecks.uppercase ? "✓" : "✕"} {t.pw_req_upper}
                                </div>
                                <div className={pwChecks.number ? "text-emerald-700" : "text-gray-600"}>
                                  {pwChecks.number ? "✓" : "✕"} {t.pw_req_num}
                                </div>
                                <div className={pwChecks.special ? "text-emerald-700" : "text-gray-600"}>
                                  {pwChecks.special ? "✓" : "✕"} {t.pw_req_special}
                                </div>
                              </div>
                            </div>
                          )}

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
                              className={`w-full rounded-2xl border bg-white px-3 py-3 pr-12 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                                fieldErr.confirm
                                  ? "border-red-400 focus:ring-red-400"
                                  : "border-gray-300"
                              }`}
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

                    {fieldErr.confirm && (
                      <div className="mt-2 flex items-start gap-2 text-xs text-red-600">
                        <span className="mt-[2px] inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-100 text-red-700">
                          !
                        </span>
                        <span>{fieldErr.confirm}</span>
                      </div>
                    )}

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
                            onClick={() => {
                              setMode("signup");
                              if (collaboratorInviteFlow) setRole("collaborator");
                            }}
                            className="font-semibold text-blue-600 hover:underline"
                          >
                            {t.signup}
                          </button>
                        </>
                      ) : (
                        <>
                          {t.have_account}{" "}
                          <button
                            onClick={() => {
                              if (collaboratorInviteFlow) return;
                              setMode("signin");
                            }}
                            className="font-semibold text-blue-600 hover:underline"
                          >
                            {t.signin}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </>
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