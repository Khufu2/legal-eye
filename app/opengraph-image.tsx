import { ImageResponse } from "next/og";

export const alt = "LOCKE — Legal intelligence.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#242426",
          color: "#f4f3ef",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 34 }}>
          <div
            style={{
              width: 112,
              height: 112,
              border: "2px solid #8f929b",
              borderRadius: 26,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 64,
              fontWeight: 700,
              letterSpacing: -5,
            }}
          >
            L
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -4 }}>LOCKE</div>
            <div style={{ fontSize: 30, color: "#b8bbc3" }}>Legal intelligence.</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
