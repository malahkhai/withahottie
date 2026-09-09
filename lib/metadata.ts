import type { Metadata } from "next";
import { siteConfig } from "./site";
export function pageMetadata(
  title: string,
  path: string,
  description: string = siteConfig.description,
  noIndex = false,
): Metadata {
  const url = new URL(path, siteConfig.url).href;
  const socialTitle = `${title} | ${siteConfig.name}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: siteConfig.name,
      title: socialTitle,
      description,
      url,
      images: [
        { url: "/og", width: 1200, height: 630, alt: siteConfig.tagline },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: ["/og"],
    },
  };
}
