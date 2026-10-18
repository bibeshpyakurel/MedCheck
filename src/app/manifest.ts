import type { MetadataRoute } from "next";

/** "Add to Home Screen" opens MedCheck full screen, with the overlap icon. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MedCheck",
    short_name: "MedCheck",
    description: "Photograph your medicines, see what their labels share, and share a simple report. Evidence, not advice.",
    start_url: "/",
    display: "standalone",
    background_color: "#090c11",
    theme_color: "#0e1218",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
