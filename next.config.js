/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  experimental: {
    serverComponentsExternalPackages: ['googleapis'],
  },
  // Vercel環境でのOpenSSL設定
  env: {
    NODE_OPTIONS: '--openssl-legacy-provider',
  },
};

module.exports = nextConfig;
