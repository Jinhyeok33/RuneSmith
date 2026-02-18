import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@runesmith/shared'],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
