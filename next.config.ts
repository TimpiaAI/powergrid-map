import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
