import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aurora Chat",
    short_name: "Aurora",
    description: "Comunicador em tempo real com salas publicas, privadas e E2EE.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#050816",
    theme_color: "#06b6d4",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
