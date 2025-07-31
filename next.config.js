/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'export', // この行を削除またはコメントアウト
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  // OpenSSLエラーを回避するための設定
  experimental: {
    serverComponentsExternalPackages: ['googleapis'],
  },
};

module.exports = nextConfig;
