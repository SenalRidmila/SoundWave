import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: '**.googleusercontent.com' },
    ],
  },
  
  // Fix Turbopack errors with dynamic binary requires
  serverExternalPackages: ['@ffmpeg-installer/ffmpeg'],
  
  // Explicitly include binaries in the Vercel serverless function
  outputFileTracingIncludes: {
    '/api/**/*': [
      './node_modules/@ffmpeg-installer/linux-x64/ffmpeg'
    ]
  },

  // Allow large response bodies for audio file downloads
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },
  
  typescript: {
    ignoreBuildErrors: true,
  }
};

export default nextConfig;
