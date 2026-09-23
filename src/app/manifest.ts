import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CRAZZY PROJECT",
    short_name: "CRAZZY",
    description: "CRAZZY PROJECT • loja, comunidade, suporte e CRAZZY CLUB.",
    start_url: "/",
    display: "standalone",
    background_color: "#020711",
    theme_color: "#0000FF",
    orientation: "portrait-primary",
    categories: ["games", "shopping", "entertainment"],
    icons: [
      {
        src: "/brand/crazzy-logo-navbar.png",
        sizes: "any",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/crazzy-logo-hero.png",
        sizes: "any",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
