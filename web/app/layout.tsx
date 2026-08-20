import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ClerkProvider } from "@clerk/nextjs";
import { esES } from "@clerk/localizations";
import { Providers } from "./providers";
import { ColorBarraEstado } from "@/components/ui/color-barra-estado";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Valor de arranque, el del landing. ColorBarraEstado lo ajusta a la pantalla
  // que se esté viendo, para que la barra de estado no corte con el contenido.
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
    <ClerkProvider localization={esES} signInForceRedirectUrl="/dashboard" afterSignOutUrl="/sign-in">
      <html
        lang="es"
        className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
      >
        <head>
          <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        </head>
        <body className="min-h-full flex flex-col">
          <ColorBarraEstado />
          <Providers>{children}</Providers>
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
