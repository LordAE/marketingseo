"use client";

import { useEffect } from "react";

export default function JoinPage() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const invite = url.searchParams.get("invite");
    const token = url.searchParams.get("token");
    const lang = url.searchParams.get("lang");

    const sp = new URLSearchParams();
    if (invite) sp.set("invite", invite);
    if (token) sp.set("token", token);
    if (lang) sp.set("lang", lang);

    const qs = sp.toString();
    window.location.replace(qs ? `/?${qs}` : "/");
  }, []);

  return <main style={{ padding: 24 }}>Redirecting…</main>;
}