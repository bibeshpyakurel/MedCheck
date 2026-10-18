import { ImageResponse } from "next/og";
import { AppIconArt } from "@/components/app-icon-art";

// The installable app's icons (/icon/192, /icon/512), listed in manifest.ts. The browser tab keeps favicon.ico.
const SIZES = [192, 512];

export function generateImageMetadata() {
  return SIZES.map((size) => ({ id: String(size), size: { width: size, height: size }, contentType: "image/png" }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const size = Number(await id);
  return new ImageResponse(<AppIconArt size={size} />, { width: size, height: size });
}
