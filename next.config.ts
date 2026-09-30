import type { NextConfig } from 'next';

// Security headers carried over from the old vercel.json.
const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Database drivers and the MP3 encoder run as plain Node modules on the server.
  serverExternalPackages: ['postgres', '@electric-sql/pglite', '@breezystack/lamejs'],
  async headers() {
    return [
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
      { source: '/fonts/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' }
        ]
      }
    ];
  }
};
export default config;
