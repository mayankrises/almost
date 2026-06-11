import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: false,
  // Allow external devices and ngrok to connect to the dev server without being blocked
  allowedDevOrigins: [
    'jaybird-revisable-clammy.ngrok-free.dev',
    '172.70.110.237'
  ],
};

export default nextConfig;


