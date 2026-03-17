/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  // NODE_OPTIONS設定を削除（Vercel環境変数で設定）
};

module.exports = nextConfig;
