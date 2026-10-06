import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Sample photography until product images are self-hosted.
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
};

export default nextConfig;
