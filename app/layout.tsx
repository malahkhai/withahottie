import type { Metadata, Viewport } from "next";
import { PageHeader } from "@/components/page-header";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ),
  title: {
    default: "ReplyPass — A little closer to the people you follow.",
    template: "%s | ReplyPass",
  },
  description:
    "A little closer to your favorite creators. Guaranteed messages, live chats, and personal replies. No reply = no charge.",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fcfbf8",
  viewportFit: "cover",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <PageHeader />
        {children}
      </body>
    </html>
  );
}
