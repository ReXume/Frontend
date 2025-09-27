import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // 빌드시 ESLint 무시
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
