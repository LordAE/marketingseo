"use client";

import { useEffect } from "react";

export default function JoinPage() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const invite = url.searchParams.get("invite");
    const token = url.searchParams.get("token");
    const lang = url.searchParams.get("lang");
    const role = url.searchParams.get("role");
    const ref = url.searchParams.get("ref");
    const agentRef = url.searchParams.get("agent_ref");
    const tutorRef = url.searchParams.get("tutor_ref");

    const sp = new URLSearchParams();
    if (invite) sp.set("invite", invite);
    if (token) sp.set("token", token);
    if (lang) sp.set("lang", lang);
    if (role) sp.set("role", role);
    if (ref) sp.set("ref", ref);
    if (agentRef) sp.set("agent_ref", agentRef);
    if (tutorRef) sp.set("tutor_ref", tutorRef);

    const qs = sp.toString();
    window.location.replace(qs ? `/?${qs}` : "/");
  }, []);

  return <main style={{ padding: 24 }}>Redirecting…</main>;
}