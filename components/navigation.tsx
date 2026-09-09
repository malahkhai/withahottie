import Link from "next/link";
import { Icon } from "@/components/icon";
export function Logo() {
  return (
    <Link href="/@stella" className="logo" aria-label="Withahottie home">
      withahottie<span className="logo-dot">.</span>
    </Link>
  );
}
export function PageHeader() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Logo />
        <span className="brand-tagline">Get paid for your attention.</span>
        <nav aria-label="Main navigation">
          <Link href="/creator/apply" className="creator-link">
            Become a creator <Icon name="arrow" size={16} />
          </Link>
          <Link className="login-link" href="/login">
            Log in <Icon name="user" size={15} />
          </Link>
        </nav>
      </div>
    </header>
  );
}
export function BottomNavigation() {
  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      <Link href="/@stella" aria-current="page">
        <Icon name="compass" />
        <span>Discover</span>
      </Link>
      <Link href="/login">
        <Icon name="message" />
        <span>Inbox</span>
      </Link>
      <Link href="/signup">
        <Icon name="heart" />
        <span>Join</span>
      </Link>
      <Link href="/login">
        <Icon name="user" />
        <span>Account</span>
      </Link>
    </nav>
  );
}
