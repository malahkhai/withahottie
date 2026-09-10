import { siteConfig } from "@/lib/site";
import { Logo, HeaderLinks } from "./navigation";
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
        <span className="brand-tagline">{siteConfig.tagline}</span>
        <HeaderLinks role={viewer?.role || null} />
      </div>
    </header>
  );
}
