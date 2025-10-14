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

  // Security headers (SEC-010)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.com https://*.clerk.com https://*.clerk.accounts.dev https://clerk.klyngcup.com https://www.google.com https://www.gstatic.com https://www.google-analytics.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://www.gstatic.com",
              "img-src 'self' data: https: https://www.google.com https://www.gstatic.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https://clerk.com https://*.clerk.com https://*.clerk.accounts.dev https://clerk.klyngcup.com https://*.supabase.com https://*.upstash.io https://www.google.com https://www.gstatic.com",
              "frame-src 'self' https://www.google.com https://accounts.google.com",
              "worker-src 'self' blob:",
              "frame-ancestors 'none'"
            ].join('; ')
          }
        ]
      }
    ];
  }
};

export default nextConfig;
