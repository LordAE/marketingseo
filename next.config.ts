import type { NextConfig } from "next";

const APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_ORIGIN || "https://app.greenpassgroup.com";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/app", destination: `${APP_ORIGIN}/` },
      { source: "/app/:path*", destination: `${APP_ORIGIN}/:path*` },
    ];
  },
};

export default nextConfig;
