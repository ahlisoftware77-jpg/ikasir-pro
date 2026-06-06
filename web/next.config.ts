import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: ["localhost:3000", "192.168.15.25:3000", "*.loca.lt"],
};

export default nextConfig;
