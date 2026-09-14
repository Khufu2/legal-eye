import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Legal Eye — Legal Intelligence",
    short_name: "Legal Eye",
    description: "Legal research, drafting, review, workflows and secure client collaboration.",
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
