"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";

/**
 * Cross-domain logout helper:
 * - The app (app.greenpassgroup.com) signs out then redirects here
 * - This page signs out again on greenpassgroup.com origin
 * - Then redirects to `next` (default "/") where your sign-in/sign-up page.tsx lives
 */
export default function LogoutPage() {
  const params = useSearchParams();
  const next = params.get("next") || "/";

  useEffect(() => {
    (async () => {
      try {
        await signOut(auth);
      } catch (e) {
        // ignore
      }
      window.location.replace(next);
    })();
  }, [next]);

  return null;
}
