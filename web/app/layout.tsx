import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ClerkProvider } from "@clerk/nextjs";
import { esES } from "@clerk/localizations";
import { Providers } from "./providers";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // El color de la barra de estado se queda como estaba y no se fuerza desde
  // acá. Se intentó de seis formas que siguiera a cada pantalla y ninguna
  // funcionó en iPhone: la barra se pinta con el color de arranque del
  // documento y no vuelve a leerlo cuando la pantalla cambia.
  //
  // Se retoma cuando la app salga en Play Store y App Store, que es donde el
  // sistema sí deja decirlo pantalla por pantalla.
  themeColor: '#09090B',
};

const SITE_URL = "https://www.veloclubtech.com";
const SITE_DESC = "Plataforma integral para la gestión de clubes deportivos";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "VeloClub",
  description: SITE_DESC,
  icons: {
    icon: "/favicon.png",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "VeloClub",
    title: "VeloClub",
    description: SITE_DESC,
    locale: "es_CO",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "VeloClub, gestión de clubes deportivos" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "VeloClub",
    description: SITE_DESC,
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider localization={esES} signInForceRedirectUrl="/inicio" afterSignOutUrl="/sign-in">
      <html
        lang="es"
        className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
      >
        <head>
          <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        </head>
        <body className="min-h-full flex flex-col">
          <Providers>{children}</Providers>
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
