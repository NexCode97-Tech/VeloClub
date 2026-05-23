import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VeloClub",
    short_name: "VeloClub",
    description: "Plataforma para clubes de patinaje",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F7F7FB",
    theme_color: "#7C3AED",
    orientation: "any",
    icons: [
      {
        src: "/icon-desktop-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-desktop-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
