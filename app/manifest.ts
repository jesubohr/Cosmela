import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cosmela",
    short_name: "Cosmela",
    description: "Agenda, fichas clínicas y consentimientos para cosmetólogas en Colombia.",
    lang: "es-CO",
    start_url: "/hoy",
    scope: "/",
    display: "standalone",
    theme_color: "#5B2A86",
    background_color: "#F6F4F8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
