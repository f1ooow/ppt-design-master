import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // 设置项目根目录（消除警告）
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
