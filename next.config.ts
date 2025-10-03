import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // turn off the auto-generated typed route validator
  typedRoutes: false,
  // Enable TypeScript checking
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
