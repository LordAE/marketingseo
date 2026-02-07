import { NextResponse } from "next/server";
import admin from "firebase-admin";

function initAdmin() {
  if (admin.apps.length) return;

  // Store this as a Vercel env var (stringified JSON)
  // Example name: FIREBASE_ADMIN_SERVICE_ACCOUNT
  const raw = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;

  if (!raw) {
    throw new Error("Missing FIREBASE_ADMIN_SERVICE_ACCOUNT env var");
  }

  const serviceAccount = JSON.parse(raw);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export async function POST(req: Request) {
  try {
    initAdmin();

    const { idToken } = await req.json();

    if (!idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    }

    // Verify the user really signed in
    const decoded = await admin.auth().verifyIdToken(idToken);

    // Mint a custom token for the same uid
    const customToken = await admin.auth().createCustomToken(decoded.uid);

    return NextResponse.json({ customToken });
  } catch (err: any) {
    console.error("custom-token error:", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
