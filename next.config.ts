import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/translate",
  // Next.js config for GitHub Pages
  images: {
    unoptimized: true, // required for static export
  },
};

export default nextConfig;
