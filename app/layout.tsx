import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

const siteUrl = "https://fulbito-pwa.vercel.app";
const socialImageUrl = `${siteUrl}/og-image.jpg?v=2`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Fulbito Arena | Torneos barriales con experiencia de juego",
  description:
    "PWA premium para crear mundiales barriales con acceso Google, roles, canchas, equipos, fixture, tabla y resultados validados.",
  applicationName: "Fulbito Arena",
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Fulbito Arena",
    title: "Fulbito Arena | El barrio entra en modo torneo",
    description:
      "PWA premium para crear mundiales barriales con experiencia de juego estilo consola.",
    images: [{ url: socialImageUrl, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fulbito Arena | El barrio entra en modo torneo",
    description:
      "PWA premium para crear mundiales barriales con experiencia de juego estilo consola.",
    images: [socialImageUrl],
  },
};

export const viewport: Viewport = {
  themeColor: "#05070d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased selection:bg-emerald-500 selection:text-black">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
