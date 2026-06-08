import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fulbito Arena",
    short_name: "Fulbito",
    description: "Torneos barriales con roles, canchas, fixture, tabla y resultados validados.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#05070d",
    theme_color: "#05070d",
    orientation: "portrait-primary",
    categories: ["sports", "productivity"],
    icons: [
      {
        src: "/assets/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: "/assets/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ],
    screenshots: [
      {
        src: "/og-image.jpg",
        sizes: "1200x630",
        type: "image/jpeg",
        form_factor: "wide",
        label: "Fulbito Arena social preview"
      },
      {
        src: "/social-preview.png",
        sizes: "1200x630",
        type: "image/png",
        form_factor: "wide",
        label: "Fulbito Arena app preview"
      }
    ],
    shortcuts: [
      {
        name: "Fixture",
        short_name: "Fixture",
        description: "Abrir calendario de partidos",
        url: "/#fixture",
        icons: [{ src: "/assets/icon-192.png", sizes: "192x192", type: "image/png" }]
      },
      {
        name: "Tabla",
        short_name: "Tabla",
        description: "Abrir clasificacion",
        url: "/#tabla",
        icons: [{ src: "/assets/icon-192.png", sizes: "192x192", type: "image/png" }]
      }
    ]
  };
}
