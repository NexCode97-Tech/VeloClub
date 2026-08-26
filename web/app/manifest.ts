import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VeloClub",
    short_name: "VeloClub",
    description: "Plataforma integral para la gestión de clubes deportivos",
    // El alcance debe ser la raiz. Sin declararlo, el navegador lo deduce de la
    // carpeta de start_url y quedaria encerrado en /dashboard/: al abrir la app
    // sin sesion, el redirect a /sign-in cae fuera del alcance y Android expulsa
    // la navegacion al navegador, que se ve como que la app no abre.
    id: "/",
    scope: "/",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F7F7FB",
    theme_color: "#381DA0",
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
