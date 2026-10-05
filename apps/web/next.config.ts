import type { NextConfig } from 'next';

/** The API origin as seen from the Next.js server process (never from the browser). */
const apiOrigin = process.env.API_ORIGIN ?? 'http://127.0.0.1:4000';

const nextConfig: NextConfig = {
  // The hosted preview is served from an *.e2b.app subdomain.
  allowedDevOrigins: ['*.e2b.app', 'localhost', '127.0.0.1'],
  /**
   * The browser only ever calls this app's own origin: `/api/v1/...` is rewritten to
   * the API process server-side. That keeps the embedded preview free of cross-origin
   * requests, and means no browser code has to know a sandbox hostname.
   */
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${apiOrigin}/api/v1/:path*` }];
  },
};

export default nextConfig;
