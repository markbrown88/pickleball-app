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

  // Allow Clerk image domains for user avatars
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
      {
        protocol: 'https',
        hostname: 'images.clerk.dev',
      },
    ],
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
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.com https://*.clerk.com https://*.clerk.accounts.dev https://clerk.klyngcup.com https://challenges.cloudflare.com https://static.cloudflareinsights.com https://vercel.live",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://challenges.cloudflare.com",
              "img-src 'self' data: https: https://challenges.cloudflare.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https://clerk.com https://*.clerk.com https://*.clerk.accounts.dev https://clerk.klyngcup.com https://clerk-telemetry.com https://*.supabase.com https://*.upstash.io https://challenges.cloudflare.com https://cloudflareinsights.com",
              "frame-src 'self' https://challenges.cloudflare.com https://vercel.live",
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
