/** @type {import('next').NextConfig} */
const serverApiBase = process.env.SERVER_API_BASE_URL || "http://localhost:8100";

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api-proxy/api/:path*",
        destination: `${serverApiBase}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
