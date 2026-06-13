import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@livekit/rtc-node", "ws"],
  // Next.js config for HMR cross-origin
  allowedDevOrigins: ["192.168.50.34", "localhost"],
};

export default nextConfig;
