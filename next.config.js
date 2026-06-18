/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  // NODE_OPTIONS設定を削除（Vercel環境変数で設定）
  webpack: (config) => {
    // pdfjs-dist は Node 用に optional な native モジュール(canvas)を参照するが、
    // ブラウザ描画では不要。webpack でバンドルできないため空モジュールに解決する。
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
      encoding: false,
    };
    return config;
  },
};

module.exports = nextConfig;
