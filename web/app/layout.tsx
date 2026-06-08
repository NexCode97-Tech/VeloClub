import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { esES } from "@clerk/localizations";
import { Providers } from "./providers";
import "./globals.css";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "VeloClub",
  description: "Plataforma para clubes de patinaje",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
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
        className="h-full antialiased"
      >
        <body className="min-h-full flex flex-col">
          {/* Desregistra service workers viejos en todos los dispositivos */}
          <script dangerouslySetInnerHTML={{ __html: `
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistrations().then(function(regs) {
                regs.forEach(function(reg) { reg.unregister(); });
              });
              caches.keys().then(function(keys) {
                keys.forEach(function(key) { caches.delete(key); });
              });
            }
          `}} />
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
