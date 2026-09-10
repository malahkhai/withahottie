"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { siteConfig } from "@/lib/site";
import { Icon } from "@/components/icon";
const profilePath = /^\/@[a-z0-9_]{3,30}$/;
export function Logo() {
  const pathname = usePathname();
  const creator = profilePath.test(pathname);
  return (
    <a
      href={creator ? `${pathname}#main` : "/"}
      className="logo"
      aria-label={
        creator
          ? `Back to ${pathname.slice(1)} profile`
          : `${siteConfig.name} home`
      }
    >
      {siteConfig.logo}
      <span className="logo-dot">.</span>
    </a>
  );
}
export function HeaderLinks({ role }: { role: string | null }) {
  const path = usePathname();
  const login = profilePath.test(path)
    ? `/login?next=${encodeURIComponent(path)}`
    : "/login";
  return (
    <nav aria-label="Main navigation">
      <Link href="/creators" className="creator-link">
        Become a creator <Icon name="arrow" size={16} />
      </Link>
      <Link
        className="login-link"
        href={
          role
            ? role === "creator" || role === "admin"
              ? "/creator/dashboard"
              : "/account"
            : login
        }
      >
        {role ? "My ReplyPass" : "Log in"}
        <Icon name="user" size={15} />
      </Link>
    </nav>
  );
}
export function BottomNavigation({ handle = "@stella" }: { handle?: string }) {
  const next = encodeURIComponent(`/${handle}`);
  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      <Link href={`/${handle}`} aria-current="page">
        <Icon name="user" />
        <span>Profile</span>
      </Link>
      <Link href="/account">
        <Icon name="message" />
        <span>Inbox</span>
      </Link>
      <Link href={`/signup?next=${next}`}>
        <Icon name="heart" />
        <span>Join</span>
      </Link>
      <Link href="/account">
        <Icon name="user" />
        <span>Account</span>
      </Link>
    </nav>
  );
}
