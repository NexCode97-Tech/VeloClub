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
    // Van los dos juegos a proposito, y no es duplicado.
    //
    // "any" es el icono tal cual: lo usa escritorio y lo usa Android cuando no
    // encuentra un maskable. Si solo se declara este, Android no se arriesga a
    // recortarlo y lo mete encogido dentro de un circulo blanco que el mismo
    // dibuja, asi que la app queda con una arandela alrededor.
    //
    // "maskable" le da permiso a recortar: Android lo usa a sangre y le aplica
    // la forma del sistema, que casi siempre es un circulo. Por eso ese archivo
    // lleva la VC mas chica, dentro de la zona que ningun recorte toca.
    //
    // iPhone no mira nada de esto: usa apple-touch-icon.png, y le pone el
    // cuadrado de esquinas redondeadas por su cuenta.
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
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
