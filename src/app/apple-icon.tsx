import { ImageResponse } from "next/og";

// Apple Touch Icon — Next 16 only accepts raster (or generated) for
// apple-icon, so we generate a 180×180 PNG via ImageResponse using the
// same brand-blue gradient + V mark as icon.svg.

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0866FF 0%, #5C9CFF 100%)",
          borderRadius: 40,
          color: "white",
          fontSize: 130,
          fontWeight: 800,
          fontFamily: "system-ui, -apple-system, sans-serif",
          letterSpacing: "-0.05em",
        }}
      >
        V
      </div>
    ),
    { ...size },
  );
}
