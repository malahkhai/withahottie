"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "./navigation";
import { Icon, type IconName } from "./icon";
import { LogoutButton } from "./logout-button";
import { useWorkspace } from "./workspace-provider";
export const creatorNav: { name: string; path: string; icon: IconName }[] = [
  { name: "Home", path: "/creator/dashboard", icon: "compass" },
  { name: "Inbox", path: "/creator/inbox", icon: "message" },
  { name: "Requests", path: "/creator/requests", icon: "bolt" },
  { name: "Subscribers", path: "/creator/subscribers", icon: "heart" },
  { name: "Payouts", path: "/creator/payouts", icon: "shield" },
  { name: "Earnings", path: "/creator/earnings", icon: "star" },
  { name: "Analytics", path: "/creator/analytics", icon: "sparkles" },
  { name: "Profile", path: "/creator/profile", icon: "user" },
  { name: "Settings", path: "/creator/settings", icon: "shield" },
];
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { data } = useWorkspace();
  return (
    <div className="workspace-shell">
      <aside className="creator-sidebar">
        <Logo />
        <span className="sidebar-label">YOUR CREATOR SPACE</span>
        <nav aria-label="Creator navigation">
          {creatorNav.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              aria-current={path.startsWith(item.path) ? "page" : undefined}
            >
              <Icon name={item.icon} />
              {item.name}
              {item.name === "Requests" &&
                data.requests.some((r) => r.status === "pending") && (
                  <span className="nav-count">
                    {data.requests.filter((r) => r.status === "pending").length}
                  </span>
                )}
            </Link>
          ))}
        </nav>
        <Link className="sidebar-public" href={`/@${data.creator.username}`}>
          <Icon name="arrow" />
          View public profile
        </Link>
        <div className="sidebar-person">
          <span className="initial-avatar sage">
            {data.creator.displayName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)}
          </span>
          <div>
            <strong>{data.creator.displayName}</strong>
            <span>@{data.creator.username}</span>
          </div>
        </div>
        <LogoutButton />
      </aside>
      <div className="workspace-main">
        <header className="workspace-topbar">
          <span>
            <i className={`status-dot ${data.creator.availability}`} />{" "}
            {data.creator.availability}
          </span>
          <div>
            {data.demo && (
              <span className="workspace-demo">DEMO WORKSPACE</span>
            )}
            <Link href={`/@${data.creator.username}`}>
              My ReplyPass <Icon name="arrow" size={15} />
            </Link>
          </div>
        </header>
        <main id="main" className="workspace-content">
          {children}
        </main>
      </div>
      <nav
        className="creator-mobile-nav"
        aria-label="Creator mobile navigation"
      >
        {creatorNav
          .filter((n) =>
            ["Home", "Inbox", "Requests", "Profile", "Settings"].includes(
              n.name,
            ),
          )
          .map((item) => (
            <Link
              key={item.path}
              href={item.path}
              aria-current={path.startsWith(item.path) ? "page" : undefined}
            >
              <Icon name={item.icon} />
              <span>{item.name}</span>
            </Link>
          ))}
      </nav>
    </div>
  );
}
