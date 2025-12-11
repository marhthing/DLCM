/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'deeperlifeclapham.org',
      },
    ],
  },
  env: {
    GOOGLE_SPREADSHEET_ID: process.env.GOOGLE_SPREADSHEET_ID,
  },
  turbopack: {},
  allowedDevOrigins: ['*.replit.dev', '*.picard.replit.dev'],
}

export default nextConfig
