/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['mysql2'],
  allowedDevOrigins: ['192.168.4.25'],
};

export default nextConfig;
