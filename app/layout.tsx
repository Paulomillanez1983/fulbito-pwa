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
  description: "PWA premium para crear mundiales barriales con acceso Google, roles, canchas, equipos, fixture, tabla y resultados validados.",
  applicationName: "Fulbito Arena",
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Fulbito Arena",
    title: "Fulbito Arena | El barrio entra en modo torneo",
    description: "Roles, canchas, equipos, fixture, tabla, grupos, eliminatorias y resultado oficial validado.",
    images: [
      {
        url: socialImageUrl,
        width: 1200,
        height: 630,
        alt: "Fulbito Arena, app de torneos barriales con estilo deportivo premium."
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Fulbito Arena | El barrio entra en modo torneo",
    description: "PWA para crear mundiales barriales con acceso Google, roles, canchas, equipos, fixture, tabla y resultados validados.",
    images: [socialImageUrl]
  },
  other: {
    "og:image:secure_url": socialImageUrl,
    "og:image:type": "image/jpeg",
    "twitter:image:alt": "Fulbito Arena, app de torneos barriales con logo oficial."
  },
  icons: {
    icon: "/assets/icon.svg",
    apple: "/assets/icon-192.png"
  }
};

export const viewport: Viewport = {
  themeColor: "#05070d",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
