import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.clerk.com' },
      { protocol: 'https', hostname: 'images.clerk.dev' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
};

export default withPWA({
  dest: "public",
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  // Excluir rutas de auth y APIs externas del Service Worker
  fallbacks: {
    document: '/offline',
  },
  workboxOptions: {
    // No interceptar rutas de Clerk, sign-in, sign-up ni APIs
    navigateFallbackDenylist: [
      /^\/sign-in/,
      /^\/sign-up/,
      /^\/api\//,
      /^\/inactivo/,
      /^\/trial-expirado/,
    ],
    runtimeCaching: [
      // No cachear dominios de Clerk
      {
        urlPattern: /^https:\/\/clerk\.veloclubtech\.com\/.*/i,
        handler: 'NetworkOnly',
      },
      {
        urlPattern: /^https:\/\/[\w-]+\.clerk\.accounts\.dev\/.*/i,
        handler: 'NetworkOnly',
      },
      // No cachear la API de Railway
      {
        urlPattern: /^https:\/\/veloclub-production\.up\.railway\.app\/.*/i,
        handler: 'NetworkOnly',
      },
      // Statics de Next.js — cache first
      {
        urlPattern: /^\/_next\/static\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'next-static',
          expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
      // Imágenes — stale while revalidate
      {
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'images',
          expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
        },
      },
    ],
  },
})(nextConfig);
