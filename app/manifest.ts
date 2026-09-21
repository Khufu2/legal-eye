import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LOCKE — Legal intelligence.",
    short_name: "LOCKE",
    description: "Legal research, drafting, review, comparison, workflows and secure firm knowledge.",
    start_url: "/",
    display: "standalone",
    background_color: "#242426",
    theme_color: "#242426",
    orientation: "any",
    categories: ["business", "productivity", "legal"],
    icons: [
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
