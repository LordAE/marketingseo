// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import LangInit from "@/app/LangInit";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://greenpassgroup.com"),
  title: "GreenPass",
  description: "GreenPass connects students, schools, agents, and tutors with verified onboarding, invite links, and QR referral flows.",

  openGraph: {
    title: "GreenPass",
    description: "GreenPass connects students, schools, agents, and tutors with verified onboarding, invite links, and QR referral flows.",
    url: "https://greenpassgroup.com",
    siteName: "GreenPass",
    type: "website",
    images: [
      {
        url: "/greenpass-og.png",
        width: 1200,
        height: 630,
        alt: "GreenPass",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "GreenPass",
    description: "GreenPass connects students, schools, agents, and tutors with verified onboarding, invite links, and QR referral flows.",
    images: ["/greenpass-og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <LangInit />
        {children}
      </body>
    </html>
  );
}