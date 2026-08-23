import { ImageResponse } from "next/og";
import { OgCard, ogSize } from "@/lib/og-card";

export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <OgCard tag="home" title="kotakunp — music for the quiet hours" />,
    size,
  );
}
