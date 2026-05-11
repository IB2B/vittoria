import { ImageResponse } from "next/og";

// Auto-generated OG image — Next 16 picks this up at /opengraph-image
// and serves a 1200×630 PNG. Used as the social preview when /vittoria
// gets shared on Slack / WhatsApp / X / etc.

export const runtime = "edge";
export const alt = "Vittoria — Multi-channel ads dashboard";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background:
            "linear-gradient(135deg, #0a1628 0%, #0c1f3d 50%, #0866FF 140%)",
          color: "white",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Halo glow */}
        <div
          style={{
            position: "absolute",
            top: -200,
            right: -150,
            width: 600,
            height: 600,
            borderRadius: 999,
            background:
              "radial-gradient(circle, rgba(8,102,255,0.5), transparent 70%)",
          }}
        />

        {/* V mark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 22,
              background: "linear-gradient(135deg, #0866FF, #5C9CFF)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 64,
              fontWeight: 700,
              color: "white",
              boxShadow: "0 8px 32px rgba(8,102,255,0.5)",
            }}
          >
            V
          </div>
          <div style={{ fontSize: 32, fontWeight: 600, opacity: 0.9 }}>
            Vittoria
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 84,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            maxWidth: 980,
          }}
        >
          <span>Every client. Every channel.</span>
          <span
            style={{
              background: "linear-gradient(135deg, #5C9CFF, #C0D7FF)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            One screen.
          </span>
        </div>

        <div
          style={{
            marginTop: 32,
            fontSize: 28,
            opacity: 0.7,
            maxWidth: 800,
          }}
        >
          Meta + Google ads cockpit, with a Sonnet-powered analyst built in.
        </div>
      </div>
    ),
    { ...size },
  );
}
