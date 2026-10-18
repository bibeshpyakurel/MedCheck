import { ImageResponse } from "next/og";
import { AppIconArt } from "@/components/app-icon-art";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home Screen icon on iPhone and iPad; iOS rounds the corners itself. */
export default function AppleIcon() {
  return new ImageResponse(<AppIconArt size={180} />, size);
}
