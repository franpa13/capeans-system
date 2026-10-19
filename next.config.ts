import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      // Excel imports (up to 5 MB) and radiografías/fotos (up to 15 MB) are
      // uploaded through server actions; the default limit is 1 MB.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
