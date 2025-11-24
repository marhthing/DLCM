/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['deeperlifeclapham.org'],
  },
  env: {
    GOOGLE_SPREADSHEET_ID: process.env.GOOGLE_SPREADSHEET_ID,
  },
}

export default nextConfig
