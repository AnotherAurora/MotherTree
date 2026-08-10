import type { NextConfig } from "next";
import { getFlatSlugRedirects } from "./src/lib/public/calculator-catalog";

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
      ...getFlatSlugRedirects(),
    ];
  },
};

export default nextConfig;
