import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/calculator",
        destination: "/calculators",
        permanent: true,
      },
      {
        source: "/calculator/:path*",
        destination: "/calculators/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
