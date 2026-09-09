import Link from "next/link";
import { siteConfig } from "@/lib/site";
export const trustLinks = [
  ["/terms", "Terms"],
  ["/privacy", "Privacy"],
  ["/community-guidelines", "Community guidelines"],
  ["/creator-terms", "Creator terms"],
] as const;
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>
        {siteConfig.name} · {siteConfig.tagline}
      </p>
      <nav aria-label="Legal and community">
        {trustLinks.map(([href, label]) => (
          <Link key={href} href={href}>
            {label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
