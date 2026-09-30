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
  // Allow large response bodies for audio file downloads
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
    outputFileTracingIncludes: {
      '/api/**/*': [
        './node_modules/@ffmpeg-installer/linux-x64/ffmpeg',
        './node_modules/yt-dlp-exec/bin/yt-dlp'
      ]
    },
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
