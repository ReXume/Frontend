/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // 브라우저 번들에서 node 전용 모듈이 섞이면 막기(안전망)
    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        canvas: false,
        fs: false,
        path: false,
      };
    }

    // PDF.js 관련 설정
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };

    // pdf.js 워커 파일을 asset/resource 로 취급 (=> import 시 URL 문자열 반환)
    config.module.rules.push({
      test: /pdf\.worker\.min\.js$/,
      type: "asset/resource",
    });

    // PDF.js에서 Node.js 전용 모듈들을 무시하도록 설정
    config.externals = config.externals || [];
    if (!isServer) {
      config.externals.push({
        canvas: "canvas",
        "utf-8-validate": "utf-8-validate",
        bufferutil: "bufferutil",
      });
    }

    return config;
  },
  eslint: {
    // 빌드시 ESLint 무시
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
