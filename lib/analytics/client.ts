"use client";
import { CONSENT_KEY, GA_ID, pageGroup, readChoice } from "./model";
type AnalyticsEvent = "creator_cta_click" | "interaction_select" | "login" | "signup_submitted" | "creator_onboarding_start" | "creator_onboarding_step" | "creator_launch_success" | "checkout_started";
declare global { interface Window { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; } }
export function analyticsAllowed() {
  try { return process.env.NEXT_PUBLIC_GA_ENABLED === "true" && location.hostname === "getreplypass.com" && readChoice(localStorage.getItem(CONSENT_KEY)) === true; } catch { return false; }
}
export function track(event: AnalyticsEvent, option?: string | number) {
  if (!analyticsAllowed()) return;
  const allowed = ["fan", "creator", "message", "live_chat", "voice_note", "photo", "video", "vip", 1, 2, 3, 4, 5];
  window.gtag?.("event", event, {
    send_to: GA_ID,
    page_location: `https://getreplypass.com/${pageGroup(location.pathname)}`,
    page_title: pageGroup(location.pathname), page_referrer: "",
    page_group: pageGroup(location.pathname),
    ...(allowed.includes(option as string | number) ? { funnel_detail: option } : {}),
  });
}
