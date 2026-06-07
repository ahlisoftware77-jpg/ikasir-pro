import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: ["localhost:3000", "192.168.15.25:3000", "*.loca.lt"],
  async rewrites() {
    return [
      {
        source: '/__/auth/:path*',
        destination: 'https://kasir-3d12b.firebaseapp.com/__/auth/:path*',
      },
    ];
  },
};

export default nextConfig;
