"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { analyticsAllowed, track } from "@/lib/analytics/client";
import { CONSENT_KEY, GA_ID, pageGroup, readChoice } from "@/lib/analytics/model";
const denied = { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" };
let initialized = false;
export function AnalyticsConsent() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    try { if (readChoice(localStorage.getItem(CONSENT_KEY)) === null) queueMicrotask(() => setVisible(true)); }
    catch { queueMicrotask(() => setVisible(true)); }
    const sync = (e: StorageEvent) => { if (e.key === CONSENT_KEY) location.reload(); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    if (!analyticsAllowed()) return;
    const group = pageGroup(pathname);
    if (!initialized) {
      window.dataLayer = window.dataLayer || [];
      // Google gtag requires an arguments object in the dataLayer queue.
      // eslint-disable-next-line prefer-rest-params
      window.gtag = function () { window.dataLayer!.push(arguments); };
      window.gtag("consent", "default", denied);
      window.gtag("consent", "update", { ...denied, analytics_storage: "granted" });
      window.gtag("js", new Date());
      window.gtag("config", GA_ID, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, page_location: `https://getreplypass.com/${group}`, page_title: group, page_referrer: "" });
      const script = document.createElement("script");
      script.async = true; script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
      document.head.appendChild(script); initialized = true;
    }
    window.gtag?.("event", "page_view", { send_to: GA_ID, page_location: `https://getreplypass.com/${group}`, page_title: group, page_referrer: "", page_group: group });
  }, [pathname, revision]);
  useEffect(() => {
    const click = (event: MouseEvent) => {
      const link = (event.target as Element)?.closest?.('a[href="/creators"], a[href="/creator/apply"]');
      if (link) track("creator_cta_click");
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, []);
  function choose(accepted: boolean) {
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ accepted, at: Date.now() })); } catch { /* No persistent storage means analytics stays disabled. */ }
    setVisible(false);
    if (!accepted && initialized) {
      Object.assign(window, { [`ga-disable-${GA_ID}`]: true });
      window.gtag?.("consent", "update", denied);
      for (const cookie of document.cookie.split(";")) {
        const name = cookie.split("=")[0].trim();
        if (/^_ga(?:_|$)/.test(name)) for (const domain of ["", `; domain=${location.hostname}`, `; domain=.${location.hostname}`]) document.cookie = `${name}=; Max-Age=0; path=/${domain}`;
      }
      location.reload();
    } else setRevision(v => v + 1);
  }
  return <>
    <div className="cookie-settings"><button type="button" onClick={() => setVisible(true)}>Cookie preferences</button></div>
    {visible && <section className="consent-banner" aria-label="Cookie preferences">
      <div><strong>A little choice about cookies.</strong><p>Essential storage keeps your account and requests working. With your permission, Google Analytics helps us understand how ReplyPass is used. No advertising cookies. You can change your choice anytime. <Link href="/privacy">Privacy details</Link></p></div>
      <div className="consent-actions"><button type="button" onClick={() => choose(false)}>Reject analytics</button><button type="button" onClick={() => choose(true)}>Accept analytics</button></div>
    </section>}
  </>;
}
