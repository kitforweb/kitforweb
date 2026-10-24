import { ImageResponse } from "next/og";
import { site } from "@/config/site";

export const ogSize = { width: 1200, height: 630 };

/** Shared Open Graph card: dark IDE look with the cyan accent. */
export function ogCard({ title, subtitle, path }: { title: string; subtitle: string; path: string }) {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "linear-gradient(135deg, #0b1220 0%, #0f1a2b 60%, #0b2530 100%)",
        color: "#e6edf3",
        fontFamily: "monospace",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, color: "#5ee7f7" }}>
        <div style={{ width: 18, height: 18, borderRadius: 4, background: "#5ee7f7", boxShadow: "0 0 24px #5ee7f7" }} />
        {site.name}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1 }}>{title}</div>
        <div style={{ fontSize: 32, color: "#9fb0c3", lineHeight: 1.35, maxWidth: 1000 }}>{subtitle}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#6b7d93" }}>
        <span>{path}</span>
        <span style={{ color: "#5ee7f7" }}>100% local · 0 bytes</span>
      </div>
    </div>,
    ogSize,
  );
}
