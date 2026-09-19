// @ts-check
import { serwist } from "@serwist/next/config";

/**
 * El worker se arma con el CLI de Serwist, no con un complemento del
 * compilador. Asi no depende de webpack y el build usa Turbopack, que es lo que
 * Next 16 trae por defecto.
 *
 * Corre despues de `next build` a proposito: para ese momento las paginas ya
 * estan generadas, asi que entran al precacheo.
 */
export default serwist({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",

  // Por defecto se precachea `public/**/*` entero, y ahi viven 16 MB de fotos
  // de la landing y de pantallazos de la ayuda. La app instalada se los bajaba
  // todos al abrirse, con datos del celular, para no usar ninguno: quien tiene
  // la app entra a /inicio, no a la pagina de venta.
  //
  // Se precachea entonces lo que la app necesita para abrir sin señal: el
  // resultado del build y los iconos con los que se instala. Lo demas se
  // guarda sobre la marcha, cuando alguien de verdad lo abre.
  // Las paginas ya generadas no entran. El modo configurador las mete por
  // defecto, y son 4 MB que se vuelven a bajar en cada despliegue porque su
  // contenido cambia con cada build. La PWA nunca las tuvo y navegar sin señal
  // es una decision de producto aparte, no algo que se cuele en un cambio de
  // herramienta.
  precachePrerendered: false,

  globPatterns: [
    ".next/static/**/*.{js,css,woff,woff2}",
    "public/icon-*.png",
    "public/apple-touch-icon.png",
    "public/favicon.png",
    "public/logo.png",
  ],
});
