import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "vokabel.werk",
    short_name: "vokabel.werk",
    description: "Vokabeln lernen",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    lang: "de",
  };
}
