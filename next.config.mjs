/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "gallardo1337.io",
        pathname: "/uploads/**",
      },
    ],
    deviceSizes: [64, 128, 192, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48],
  },
};

export default nextConfig;
