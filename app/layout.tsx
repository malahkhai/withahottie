import { AnalyticsConsent } from "@/components/analytics-consent";
import type { Metadata, Viewport } from "next";
import { PageHeader } from "@/components/page-header";
import "./globals.css";
import { siteConfig } from "@/lib/site";
import { SiteFooter } from "@/components/site-footer";
export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  applicationName: siteConfig.name,
  title: { default: siteConfig.title, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
    url: siteConfig.url,
    images: [{ url: "/og", width: 1200, height: 630, alt: siteConfig.tagline }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
    images: ["/og"],
  },
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
        <SiteFooter />
        <AnalyticsConsent />
      </body>
    </html>
  );
}
