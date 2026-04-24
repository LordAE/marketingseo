"use client";

import { useSearchParams } from "next/navigation";
import type { ReadonlyURLSearchParams } from "next/navigation";
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

const APP_BASE = "https://app.greenpassgroup.com";
const PENDING_REFERRAL_STORAGE_KEY = "gp_pending_referral_context";

type PendingReferralContext = {
  ref?: string;
  student_ref?: string;
  agent_ref?: string;
  tutor_ref?: string;
  role?: string;
};

function cleanToken(value: string | null | undefined) {
  return String(value || "").trim();
}

function buildReferralContextFromSearch(
  search: URLSearchParams | ReadonlyURLSearchParams | null | undefined
): PendingReferralContext {
  if (!search) return {};

  const role = cleanToken(search.get("role") || search.get("userType"));

  return {
    ref: cleanToken(search.get("ref")),
    student_ref: cleanToken(search.get("student_ref")),
    agent_ref: cleanToken(search.get("agent_ref")),
    tutor_ref: cleanToken(search.get("tutor_ref")),
    role,
  };
}

function hasReferralContext(ctx?: PendingReferralContext | null) {
  if (!ctx) return false;
  return Boolean(
    cleanToken(ctx.ref) ||
      cleanToken(ctx.student_ref) ||
      cleanToken(ctx.agent_ref) ||
      cleanToken(ctx.tutor_ref)
  );
}

function persistReferralContext(ctx?: PendingReferralContext | null) {
  if (typeof window === "undefined" || !hasReferralContext(ctx)) return;

  const payload: PendingReferralContext = {};
  if (cleanToken(ctx?.ref)) payload.ref = cleanToken(ctx?.ref);
  if (cleanToken(ctx?.student_ref)) payload.student_ref = cleanToken(ctx?.student_ref);
  if (cleanToken(ctx?.agent_ref)) payload.agent_ref = cleanToken(ctx?.agent_ref);
  if (cleanToken(ctx?.tutor_ref)) payload.tutor_ref = cleanToken(ctx?.tutor_ref);
  if (cleanToken(ctx?.role)) payload.role = cleanToken(ctx?.role);

  try {
    window.sessionStorage.setItem(
      PENDING_REFERRAL_STORAGE_KEY,
      JSON.stringify(payload)
    );
  } catch {}

  try {
    window.localStorage.setItem(
      PENDING_REFERRAL_STORAGE_KEY,
      JSON.stringify(payload)
    );
  } catch {}
}

function readStoredReferralContext(): PendingReferralContext {
  if (typeof window === "undefined") return {};

  const readRaw = () => {
    try {
      const fromSession = window.sessionStorage.getItem(PENDING_REFERRAL_STORAGE_KEY);
      if (fromSession) return fromSession;
    } catch {}

    try {
      const fromLocal = window.localStorage.getItem(PENDING_REFERRAL_STORAGE_KEY);
      if (fromLocal) return fromLocal;
    } catch {}

    return "";
  };

  const raw = readRaw();
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw || "{}");
    return {
      ref: cleanToken(parsed?.ref),
      student_ref: cleanToken(parsed?.student_ref),
      agent_ref: cleanToken(parsed?.agent_ref),
      tutor_ref: cleanToken(parsed?.tutor_ref),
      role: cleanToken(parsed?.role),
    };
  } catch {
    return {};
  }
}

function getMergedReferralContext(
  current?: PendingReferralContext | null
): PendingReferralContext {
  const stored = readStoredReferralContext();

  const merged: PendingReferralContext = {
    ref: cleanToken(current?.ref) || cleanToken(stored?.ref),
    student_ref: cleanToken(current?.student_ref) || cleanToken(stored?.student_ref),
    agent_ref: cleanToken(current?.agent_ref) || cleanToken(stored?.agent_ref),
    tutor_ref: cleanToken(current?.tutor_ref) || cleanToken(stored?.tutor_ref),
    role: cleanToken(current?.role) || cleanToken(stored?.role),
  };

  if (hasReferralContext(merged)) {
    persistReferralContext(merged);
  }

  return merged;
}

function appLink(path: string, lang: string) {
  const cleanPath = (path || "/").startsWith("/") ? path : `/${path}`;
  const code = lang || "en";
  const sep = cleanPath.includes("?") ? "&" : "?";
  return `${APP_BASE}${cleanPath}${sep}lang=${encodeURIComponent(code)}`;
}

function safeNextPath(p: string) {
  const raw = (p || "").trim();
  if (!raw) return "";
  if (!raw.startsWith("/")) return "";
  if (raw.startsWith("//")) return "";
  const lower = raw.toLowerCase();
  if (lower.includes("http://") || lower.includes("https://")) return "";
  return raw;
}

const FUNCTIONS_BASE =
  (process.env.NEXT_PUBLIC_FUNCTIONS_BASE as string | undefined) ||
  "https://us-central1-greenpass-dc92d.cloudfunctions.net";

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

async function getTutorReferralPublic(ref: string) {
  const r = await fetch(
    `${FUNCTIONS_BASE.replace(/\/+$/, "")}/getTutorReferralPublic?tutor_ref=${encodeURIComponent(ref)}`,
    { method: "GET" }
  );

  if (!r.ok) {
    const msg = await r.text().catch(() => "");
    throw new Error(msg || "Invalid tutor referral");
  }

  return r.json().catch(() => ({} as any));
}

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

async function acceptTutorReferral(user: User, tutorRef: string) {
  const idToken = await user.getIdToken();

  const r = await fetch(
    `${FUNCTIONS_BASE.replace(/\/+$/, "")}/acceptTutorReferral`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ tutor_ref: tutorRef }),
    }
  );

  if (!r.ok) {
    const msg = await r.text().catch(() => "");
    throw new Error(msg || "Failed to accept tutor referral");
  }

  return r.json().catch(() => ({} as any));
}

type RoleValue = "user" | "agent" | "tutor" | "school" | "collaborator";

const ROLE_ITEMS: {
  value: Exclude<RoleValue, "collaborator">;
  key: string;
  def: string;
}[] = [
  { value: "user", key: "role_student", def: "Student" },
  { value: "agent", key: "role_agent", def: "Agent" },
  { value: "tutor", key: "role_tutor", def: "Tutor" },
  { value: "school", key: "role_school", def: "School" },
];

const tr = trHome;

function normalizeUserRole(data: any): string {
  const raw = String(data?.role || "").toLowerCase().trim();

  if (raw === "student") return "user";
  if (raw === "institution") return "school";
  if (raw === "provider") return "vendor";

  return raw || "user";
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
    const { collection, getDocs, limit, query, where } = await import(
      "firebase/firestore"
    );

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

  if (chosen && !data.role) {
    patch.role = chosen;
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
  params: ReadonlyURLSearchParams,
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
  const mergedReferral = getMergedReferralContext(
    buildReferralContextFromSearch(params)
  );

  const bridgeParams = new URLSearchParams();
  bridgeParams.set("code", code);
  bridgeParams.set("next", next);

  if (fallbackRole) {
    bridgeParams.set("role", fallbackRole);
  }

  if (cleanToken(mergedReferral.ref)) {
    bridgeParams.set("ref", cleanToken(mergedReferral.ref));
  }

  if (cleanToken(mergedReferral.student_ref)) {
    bridgeParams.set("student_ref", cleanToken(mergedReferral.student_ref));
  }

  if (cleanToken(mergedReferral.agent_ref)) {
    bridgeParams.set("agent_ref", cleanToken(mergedReferral.agent_ref));
  }

  if (cleanToken(mergedReferral.tutor_ref)) {
    bridgeParams.set("tutor_ref", cleanToken(mergedReferral.tutor_ref));
  }

  window.location.href = appLink(`/auth-bridge?${bridgeParams.toString()}`, lang);
}

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
  const collaboratorRefToken = params.get("ref") || "";
  const studentReferralToken = params.get("student_ref") || "";
  const agentReferralToken = params.get("agent_ref") || "";
  const tutorReferralToken = params.get("tutor_ref") || "";
  const rawRoleParam = (params.get("role") || params.get("userType") || "")
    .trim()
    .toLowerCase();
  const collaboratorInviteFlow =
    rawRoleParam === "collaborator" && Boolean(collaboratorRefToken);
  const rawNextFromUrl = params.get("next") || "";
  const nextFromUrl = safeNextPath(rawNextFromUrl);
  const logout = params.get("logout") === "1";
  const [logoutDone, setLogoutDone] = useState(!logout);
  const [booting, setBooting] = useState(true);

  const hasInvite = Boolean(inviteId && inviteToken);
  const directReferralType = agentReferralToken
    ? "agent"
    : tutorReferralToken
    ? "tutor"
    : "";
  const directReferralToken = agentReferralToken || tutorReferralToken || "";
  const roleLockedByReferral =
    Boolean(directReferralToken) && !hasInvite && !collaboratorInviteFlow;

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [authView, setAuthView] = useState<"auth" | "forgot">("auth");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [fieldErr, setFieldErr] = useState<{
    email?: string;
    password?: string;
    confirm?: string;
    role?: string;
  }>({});

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
    try {
      const current = buildReferralContextFromSearch(params);
      if (hasReferralContext(current)) {
        persistReferralContext(current);
      } else {
        getMergedReferralContext(current);
      }
    } catch {}
  }, [
    params,
    collaboratorRefToken,
    studentReferralToken,
    agentReferralToken,
    tutorReferralToken,
    rawRoleParam,
  ]);

  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const invite = p.get("invite");
      const token = p.get("token");
      const ref = (p.get("ref") || "").trim();
      const studentRef = (p.get("student_ref") || "").trim();
      const agentRef = (p.get("agent_ref") || "").trim();
      const tutorRef = (p.get("tutor_ref") || "").trim();
      const rawRole = (p.get("role") || p.get("userType") || "")
        .trim()
        .toLowerCase();

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

      if (studentRef || agentRef || tutorRef) {
        setMode("signup");
        setAuthView("auth");
        setMsg(null);

        if (agentRef || tutorRef) {
          setRole("user");
        }

        return;
      }
    } catch {}
  }, []);

  useEffect(() => {
    setAuthView("auth");
  }, [mode]);

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
      if (!directReferralToken) return;

      if (!hasInvite) {
        setMode("signup");
        setRole("user");
        setAuthView("auth");
        setMsg(null);
      }

      try {
        setReferralLoading(true);
        const data =
          directReferralType === "tutor"
            ? await getTutorReferralPublic(directReferralToken)
            : await getAgentReferralPublic(directReferralToken);

        if (!cancelled) {
          setReferralPreview({
            ...data,
            referralType: directReferralType || "agent",
          });
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
  }, [directReferralToken, directReferralType, hasInvite]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!collaboratorInviteFlow || !collaboratorRefToken) {
        if (!cancelled) setReferredByCollaboratorUid("");
        return;
      }

      const uid = await resolveCollaboratorRef(collaboratorRefToken);
      if (!cancelled) {
        setReferredByCollaboratorUid(uid || "");
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [collaboratorInviteFlow, collaboratorRefToken]);

  const [lang, setLang] = useState<LangCode>(DEFAULT_LANG);

  useEffect(() => {
    const initial = normalizeLang(urlLangRaw || resolveInitialLang());
    setLang(initial);
    setLangEverywhere(initial);
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

  const bootEffectKey = [
    lang,
    logout ? "1" : "0",
    logoutDone ? "1" : "0",
    hasInvite ? "1" : "0",
    inviteId,
    inviteToken,
    nextFromUrl,
    collaboratorRefToken,
    studentReferralToken,
    agentReferralToken,
    tutorReferralToken,
    collaboratorInviteFlow ? "1" : "0",
    referredByCollaboratorUid,
  ].join("|");

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
              params,
              "collaborator",
              nextFromUrl,
              hasInvite ? { inviteId, token: inviteToken } : undefined,
              {
                skipDocCheck: false,
                collaboratorRef: collaboratorRefToken,
                referredByCollaboratorUid,
                signupEntryRole: "collaborator",
              }
            );
            return;
          }

          if (directReferralToken) {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);
            const userData = userSnap.exists() ? userSnap.data() || {} : {};
            const roleNow = normalizeUserRole(userData);

            if (roleNow === "user") {
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
            params,
            undefined,
            nextFromUrl,
            hasInvite ? { inviteId, token: inviteToken } : undefined,
            {
              skipDocCheck: !hasInvite,
            }
          );
          return;
        }
      } catch {}

      if (!cancelled) {
        setBooting(false);
      }
    }

    boot();

    return () => {
      cancelled = true;
    };
  }, [bootEffectKey, params]);

  const HERO_MEDIA = {
    main:
      "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80",
    secondary:
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=900&q=80",
    small: "/images/welcome/school-card.jpg",
    smallFallback:
      "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=900&q=80",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=500&q=80",
  };

  const pwChecks = useMemo(() => {
    const pw = password || "";
    return {
      length: pw.length >= 8,
      uppercase: /[A-Z]/.test(pw),
      number: /[0-9]/.test(pw),
      special: /[!@#$%^&*(),.?\":{}|<>\[\]\\\\\/;'`~_+=\-]/.test(pw),
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
        if (role !== "user") return false;
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
    collaboratorInviteFlow,
  ]);

  function scrollToAuth() {
    if (typeof document === "undefined") return;
    document.getElementById("auth-card")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
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
    if (!auth.currentUser || !directReferralToken) return;

    try {
      setBusy(true);
      setMsg(null);

      if (directReferralType === "tutor") {
        await acceptTutorReferral(auth.currentUser, directReferralToken);
      } else {
        await acceptAgentReferral(auth.currentUser, directReferralToken);
      }

      await routeLikeWelcome(
        auth.currentUser,
        lang,
        params,
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

        if (directReferralToken) {
          const userRef = doc(db, "users", cred.user.uid);
          const userSnap = await getDoc(userRef);
          const userData = userSnap.exists() ? userSnap.data() || {} : {};
          const roleNow = normalizeUserRole(userData);

          if (roleNow === "user") {
            setShowReferralAccept(true);
            setBooting(false);
            return;
          }
        }

        await routeLikeWelcome(
          cred.user,
          lang,
          params,
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

      if (roleLockedByReferral && role !== "user") {
        setRole("user");
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
          collaboratorRef: collaboratorRefToken,
          referredByCollaboratorUid,
          signupEntryRole: "collaborator",
        });

        await routeLikeWelcome(
          cred.user,
          lang,
          params,
          "collaborator",
          nextFromUrl,
          hasInvite ? { inviteId, token: inviteToken } : undefined,
          {
            collaboratorRef: collaboratorRefToken,
            referredByCollaboratorUid,
            signupEntryRole: "collaborator",
          }
        );
        return;
      }

      if (!hasInvite && role) {
        await ensureUserDoc(cred.user, role as RoleValue);
      }

      if (directReferralToken) {
        if (directReferralType === "tutor") {
          await acceptTutorReferral(cred.user, directReferralToken);
        } else {
          await acceptAgentReferral(cred.user, directReferralToken);
        }
      }

      await routeLikeWelcome(
        cred.user,
        lang,
        params,
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
          params,
          "collaborator",
          nextFromUrl,
          hasInvite ? { inviteId, token: inviteToken } : undefined,
          {
            collaboratorRef: collaboratorRefToken,
            referredByCollaboratorUid,
            signupEntryRole: "collaborator",
          }
        );
        return;
      }

      if (directReferralToken && (roleNow === "user")) {
        setShowReferralAccept(true);
        setBooting(false);
        return;
      }

      await routeLikeWelcome(
        cred.user,
        lang,
        params,
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
          params,
          "collaborator",
          nextFromUrl,
          hasInvite ? { inviteId, token: inviteToken } : undefined,
          {
            collaboratorRef: collaboratorRefToken,
            referredByCollaboratorUid,
            signupEntryRole: "collaborator",
          }
        );
        return;
      }

      if (directReferralToken && (roleNow === "user")) {
        setShowReferralAccept(true);
        setBooting(false);
        return;
      }

      await routeLikeWelcome(
        cred.user,
        lang,
        params,
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
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,#eff6ff_0%,#f8fafc_45%,#ffffff_100%)] text-gray-700">
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-white/70 bg-white/80 px-8 py-7 shadow-[0_20px_80px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="h-11 w-11 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />
          <div className="text-sm font-semibold">Redirecting…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#eff6ff_0%,#f8fafc_28%,#ffffff_100%)] text-slate-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-emerald-200/35 blur-3xl" />
        <div className="absolute right-[-80px] top-[-30px] h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="absolute bottom-[-80px] left-1/3 h-72 w-72 rounded-full bg-cyan-100/60 blur-3xl" />
      </div>

      <div className="relative z-10">
        <Navbar
          lang={lang}
          onLangChange={(code) => {
            const normalized = normalizeLang(String(code));
            setLang(normalized);
            setLangEverywhere(normalized);
          }}
        />

        <main className="flex-1 px-4 pb-6 pt-3 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1440px]">
            <div className="grid min-h-[calc(100vh-108px)] items-center gap-6 lg:grid-cols-[minmax(0,1fr)_460px] xl:gap-10">
              <section className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,#fff7ed_0%,#fdf2f8_24%,#eef2ff_48%,#ecfeff_72%,#f0fdf4_100%)] p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-8 lg:p-10 xl:p-12">
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  <div className="absolute -left-14 top-12 h-44 w-44 rounded-full bg-yellow-300/40 blur-3xl" />
                  <div className="absolute left-1/3 top-0 h-40 w-40 rounded-full bg-pink-300/35 blur-3xl" />
                  <div className="absolute right-8 top-12 h-44 w-44 rounded-full bg-blue-300/35 blur-3xl" />
                  <div className="absolute bottom-0 left-1/4 h-44 w-44 rounded-full bg-emerald-300/30 blur-3xl" />
                </div>

                <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,520px)] lg:items-center">
                  <div className="max-w-xl">
                    <h1 className="text-4xl font-black leading-[0.94] tracking-[-0.05em] text-slate-950 sm:text-5xl lg:text-6xl xl:text-7xl">
                      {tr(lang, "hero_short_h1_1", "Study abroad,")}
                      <span className="mt-2 block text-emerald-500">
                        {tr(lang, "hero_short_h1_2", "made simpler.")}
                      </span>
                    </h1>

                    <p className="mt-5 max-w-md text-base leading-8 text-slate-600 sm:max-w-lg sm:text-lg">
                      {tr(
                        lang,
                        "hero_short_sub",
                        "Connect with verified students, schools, agents, and tutors."
                      )}
                    </p>
                  </div>

                  <div className="relative mx-auto mt-2 hidden h-[520px] w-full max-w-[500px] md:block">
                    <div className="absolute left-0 top-32 z-10 w-[42%] overflow-hidden rounded-[28px] bg-white shadow-[0_18px_48px_rgba(15,23,42,0.12)] ring-1 ring-white/70">
                      <img
                        src={HERO_MEDIA.small}
                        alt="Schools"
                        className="h-[210px] w-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.src = HERO_MEDIA.smallFallback;
                        }}
                      />
                    </div>

                    <div className="absolute left-[14%] top-[14%] z-20 w-[56%] overflow-hidden rounded-[30px] bg-white shadow-[0_28px_70px_rgba(15,23,42,0.16)] ring-1 ring-white/70">
                      <img
                        src={HERO_MEDIA.main}
                        alt="Students"
                        className="h-[320px] w-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute right-3 top-3 rounded-2xl bg-[linear-gradient(135deg,#6366f1,#8b5cf6)] px-3 py-2 text-sm font-bold text-white shadow-lg">
                        Verified
                      </div>
                    </div>

                    <div className="absolute left-[10%] top-[56%] z-30 w-[42%] overflow-hidden rounded-[26px] bg-white p-3 shadow-[0_18px_48px_rgba(15,23,42,0.14)] ring-1 ring-white/70">
                      <img
                        src={HERO_MEDIA.secondary}
                        alt="Tutors"
                        className="h-[150px] w-full rounded-[20px] object-cover"
                        loading="lazy"
                      />
                      <div className="mt-3 h-3 w-24 rounded-full bg-slate-200" />
                      <div className="mt-2 h-3 w-20 rounded-full bg-slate-200" />
                    </div>

                    <div className="absolute left-[34%] top-[78%] z-40 flex w-[120px] items-center justify-center rounded-full bg-white p-1 shadow-[0_18px_48px_rgba(15,23,42,0.14)] ring-4 ring-[#f7f8fa]">
                      <img
                        src={HERO_MEDIA.avatar}
                        alt="Community"
                        className="h-[110px] w-[110px] rounded-full object-cover"
                        loading="lazy"
                      />
                    </div>

                    <div className="absolute right-[6%] top-[72%] z-30 rounded-full bg-[linear-gradient(135deg,#fb7185,#f43f5e)] px-5 py-4 text-2xl text-white shadow-[0_18px_48px_rgba(244,63,94,0.35)]">
                      ❤
                    </div>

                    <div className="absolute left-[4%] top-[8%] text-5xl drop-shadow-sm">🎓</div>
                  </div>
                </div>
              </section>

              <section id="login_ui" className="flex items-center justify-center lg:justify-end">
                <div className="w-full max-w-[440px]">
                  {showReferralAccept && referralPreview ? (
                    <div className="overflow-hidden rounded-[30px] border border-white/80 bg-white/90 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur sm:p-6">
                      <div className="rounded-[24px] bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_55%,#065f46_100%)] p-5 text-white">
                        <div className="text-xl font-bold">
                          Connect with {referralPreview?.referralType === "tutor" ? "tutor" : "agent"}
                        </div>
                        <div className="mt-1 text-sm text-white/80">
                          Accept this referral to continue.
                        </div>
                      </div>

                      <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                          {referralPreview?.referralType === "tutor" ? "Tutor referral" : "Agent referral"}
                        </p>
                        <p className="mt-2 text-lg font-bold text-slate-900">
                          {referralPreview?.referralType === "tutor"
                            ? referralPreview?.tutorName || "Tutor"
                            : referralPreview?.agentName || "Agent"}
                        </p>
                        {(referralPreview?.referralType === "tutor"
                          ? referralPreview?.tutorCompany
                          : referralPreview?.agentCompany) ? (
                          <p className="mt-1 text-sm text-slate-600">
                            {referralPreview?.referralType === "tutor"
                              ? referralPreview?.tutorCompany
                              : referralPreview?.agentCompany}
                          </p>
                        ) : null}
                      </div>

                      {referralLoading && (
                        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                          Loading referral...
                        </div>
                      )}

                      {msg && (
                        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                          {msg}
                        </div>
                      )}

                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={handleAcceptReferralNow}
                          disabled={busy}
                          className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
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
                                params,
                                undefined,
                                nextFromUrl,
                                hasInvite ? { inviteId, token: inviteToken } : undefined,
                                { skipDocCheck: !hasInvite }
                              );
                            }
                          }}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60"
                        >
                          Skip
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        id="auth-card"
                        className="overflow-hidden rounded-[30px] border border-white/80 bg-white/92 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur sm:p-6"
                      >
                        {authView === "auth" &&
                          mode === "signup" &&
                          !roleLockedByReferral &&
                          !collaboratorInviteFlow && (
                            <div className="mb-5">
                              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                {t.choose_role}
                              </label>

                              <select
                                value={role}
                                onChange={(e) => setRole(e.target.value as RoleValue)}
                                disabled={busy || inviteRoleLoading || hasInvite}
                                className={`w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 ${
                                  fieldErr.role
                                    ? "border-red-400 focus:ring-red-400"
                                    : "border-slate-200 focus:ring-emerald-500"
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
                                <div className="mt-2 flex items-start gap-2 text-xs text-red-600">
                                  <span className="mt-[2px] inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-100 text-red-700">
                                    !
                                  </span>
                                  <span>{fieldErr.role}</span>
                                </div>
                              )}
                            </div>
                          )}

                        {authView === "auth" && mode === "signup" && collaboratorInviteFlow && (
                          <div className="mb-5 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
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
                          <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                            Signing up as:{" "}
                            <strong>{tr(lang, "role_student", "Student")}</strong>
                            <span className="ml-1">
                              via {directReferralType === "tutor" ? "tutor" : "agent"} QR referral
                            </span>
                          </div>
                        )}

                        {authView === "auth" && (
                          <div className="space-y-3">
                            <button
                              onClick={handleGoogle}
                              disabled={busy}
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 disabled:opacity-60"
                            >
                              {t.google}
                            </button>

                            <button
                              onClick={handleApple}
                              disabled={busy}
                              className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                            >
                              {t.apple}
                            </button>

                            <div className="my-3 flex items-center gap-3">
                              <div className="h-px flex-1 bg-slate-200" />
                              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                {t.or}
                              </div>
                              <div className="h-px flex-1 bg-slate-200" />
                            </div>
                          </div>
                        )}

                        <div className="space-y-3">
                          <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                              {t.email}
                            </label>
                            <input
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder={t.email_ph}
                              className={`w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 ${
                                fieldErr.email
                                  ? "border-red-400 focus:ring-red-400"
                                  : "border-slate-200 focus:ring-emerald-500"
                              }`}
                              autoComplete="email"
                            />
                            {fieldErr.email && (
                              <div className="mt-2 flex items-start gap-2 text-xs text-red-600">
                                <span className="mt-[2px] inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-100 text-red-700">
                                  !
                                </span>
                                <span>{fieldErr.email}</span>
                              </div>
                            )}
                          </div>

                          {authView === "auth" && (
                            <div>
                              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                {t.password}
                              </label>
                              <div className="relative">
                                <input
                                  value={password}
                                  onChange={(e) => setPassword(e.target.value)}
                                  placeholder={t.password_ph}
                                  type={showPassword ? "text" : "password"}
                                  className={`w-full rounded-2xl border bg-white px-4 py-3 pr-12 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 ${
                                    fieldErr.password
                                      ? "border-red-400 focus:ring-red-400"
                                      : "border-slate-200 focus:ring-emerald-500"
                                  }`}
                                  autoComplete={
                                    mode === "signin" ? "current-password" : "new-password"
                                  }
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPassword((v) => !v)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
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
                                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-xs">
                                  <div className="mb-3 font-semibold text-slate-700">
                                    {t.pw_req_title}
                                  </div>

                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <div
                                      className={
                                        pwChecks.length ? "text-emerald-700" : "text-slate-600"
                                      }
                                    >
                                      {pwChecks.length ? "✓" : "✕"} {t.pw_req_len}
                                    </div>
                                    <div
                                      className={
                                        pwChecks.uppercase
                                          ? "text-emerald-700"
                                          : "text-slate-600"
                                      }
                                    >
                                      {pwChecks.uppercase ? "✓" : "✕"} {t.pw_req_upper}
                                    </div>
                                    <div
                                      className={
                                        pwChecks.number ? "text-emerald-700" : "text-slate-600"
                                      }
                                    >
                                      {pwChecks.number ? "✓" : "✕"} {t.pw_req_num}
                                    </div>
                                    <div
                                      className={
                                        pwChecks.special ? "text-emerald-700" : "text-slate-600"
                                      }
                                    >
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
                                    className="text-xs font-semibold text-slate-700 hover:text-emerald-700 hover:underline"
                                  >
                                    {t.forgot_pw}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {authView === "auth" && mode === "signup" && (
                            <div>
                              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                {t.confirm}
                              </label>
                              <div className="relative">
                                <input
                                  value={confirm}
                                  onChange={(e) => setConfirm(e.target.value)}
                                  placeholder={t.confirm_ph}
                                  type={showConfirm ? "text" : "password"}
                                  className={`w-full rounded-2xl border bg-white px-4 py-3 pr-12 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 ${
                                    fieldErr.confirm
                                      ? "border-red-400 focus:ring-red-400"
                                      : "border-slate-200 focus:ring-emerald-500"
                                  }`}
                                  autoComplete="new-password"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowConfirm((v) => !v)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
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
                          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {msg}
                          </div>
                        )}

                        {authView === "auth" ? (
                          <button
                            onClick={handleEmailAuth}
                            disabled={!canSubmit || busy}
                            className="mt-5 w-full rounded-2xl bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {busy ? t.loading : mode === "signin" ? t.cta_login : t.cta_signup}
                          </button>
                        ) : (
                          <div className="mt-5 space-y-3">
                            <button
                              onClick={handleSendReset}
                              disabled={!email || busy}
                              className="w-full rounded-2xl bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
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
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60"
                            >
                              {t.back_to_login}
                            </button>
                          </div>
                        )}

                        <p className="mt-4 text-center text-xs leading-5 text-slate-500">
                          {t.after_login}
                        </p>
                      </div>

                      {authView === "auth" && (
                        <div className="mt-4 rounded-2xl border border-white/80 bg-white/70 p-4 text-center text-sm text-slate-600 shadow-sm">
                          {mode === "signin" ? (
                            <>
                              {t.no_account}{" "}
                              <button
                                onClick={() => {
                                  setMode("signup");
                                  if (collaboratorInviteFlow) setRole("collaborator");
                                }}
                                className="font-semibold text-emerald-700 hover:underline"
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
                                className="font-semibold text-emerald-700 hover:underline"
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
          </div>

          <div className="mx-auto mt-6 max-w-[1440px] rounded-[24px] border border-white/80 bg-white/70 px-4 py-4 shadow-sm backdrop-blur sm:px-6">
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
    </div>
  );
}