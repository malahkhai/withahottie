import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";
export const dynamic = "force-static";
/** Replace this text-based artwork here when final branded artwork is approved. */
export function GET() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#fcfbf8",
        color: "#20251f",
        width: "100%",
        height: "100%",
        padding: "72px",
      }}
    >
      <div style={{ display: "flex", fontSize: 62, fontWeight: 700 }}>
        {siteConfig.logo}
        <span style={{ color: "#d6483c" }}>.</span>
      </div>
      <div style={{ fontSize: 68, maxWidth: 940, lineHeight: 1.12 }}>
        {siteConfig.tagline}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 28,
        }}
      >
        <span>{siteConfig.fanPromise}</span>
        <span>{siteConfig.domain}</span>
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
