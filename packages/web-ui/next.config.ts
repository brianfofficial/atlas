import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@atlas/shared'],
  experimental: {
    // Enable server actions for form handling
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

export default nextConfig
