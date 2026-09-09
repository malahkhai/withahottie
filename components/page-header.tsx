import Link from "next/link";
import { siteConfig } from "@/lib/site";
import { Logo } from "./navigation";
import { Icon } from "./icon";
import { getViewer } from "@/lib/auth/session";
export async function PageHeader() {
  let viewer = null;
  try {
    viewer = await getViewer();
  } catch {
    /* Auth pages remain reachable if profile setup needs repair. */
  }
  return (
    <header className="site-header">
      <div className="header-inner">
        <Logo />
        <span className="brand-tagline">
          {siteConfig.tagline}
        </span>
        <nav aria-label="Main navigation">
          <Link href="/creator/apply" className="creator-link">
            Become a creator <Icon name="arrow" size={16} />
          </Link>
          <Link
            className="login-link"
            href={
              viewer
                ? viewer.role === "creator"
                  ? "/creator/dashboard"
                  : "/account"
                : "/login"
            }
          >
            {viewer ? "My ReplyPass" : "Log in"}
            <Icon name="user" size={15} />
          </Link>
        </nav>
      </div>
    </header>
  );
}
