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
  // Node.jsの設定
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer'),
      };
    }
    return config;
  },
};

module.exports = nextConfig;
