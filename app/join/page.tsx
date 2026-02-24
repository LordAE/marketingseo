"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Invite URL format:
//  https://greenpassgroup.com/join?invite=...&token=...
// This is a CLIENT redirect so it works even on static hosting.

export default function JoinPage() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const invite = params.get("invite");
    const token = params.get("token");
    const lang = params.get("lang");

    const sp = new URLSearchParams();
    if (invite) sp.set("invite", invite);
    if (token) sp.set("token", token);
    if (lang) sp.set("lang", lang);

    const qs = sp.toString();
    router.replace(qs ? `/?${qs}` : "/");
  }, [params, router]);

  return (
    <main style={{ padding: 24 }}>
      Redirecting…
    </main>
  );
}
