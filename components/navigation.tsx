import Link from "next/link";
import { siteConfig } from "@/lib/site";
import { Icon } from "@/components/icon";
export function Logo() {
  return (
    <Link href="/@stella" className="logo" aria-label={`${siteConfig.name} home`}>
      {siteConfig.logo}<span className="logo-dot">.</span>
    </Link>
  );
}
export function BottomNavigation() {
  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      <Link href="/@stella" aria-current="page">
        <Icon name="compass" />
        <span>Discover</span>
      </Link>
      <Link href="/account">
        <Icon name="message" />
        <span>Inbox</span>
      </Link>
      <Link href="/signup">
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
