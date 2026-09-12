export const GA_ID = "G-C6DL1WLHDM";
export const CONSENT_KEY = "replypass:analytics-consent:v1";
export function analyticsHostAllowed(hostname: string) {
  return hostname === "getreplypass.com" || hostname === "www.getreplypass.com";
}
export function pageGroup(path: string) {
  if (/^\/@[^/]+$/.test(path)) return "creator_profile";
  if (/^\/creator\/inbox\/[^/]+$/.test(path)) return "creator_conversation";
  const pages: Record<string, string> = {
    "/": "home", "/creators": "creator_landing", "/login": "login", "/signup": "signup",
    "/creator/apply": "creator_onboarding", "/account": "fan_account", "/account/requests": "fan_requests",
    "/terms": "terms", "/privacy": "privacy", "/community-guidelines": "community_guidelines", "/creator-terms": "creator_terms",
  };
  if (pages[path]) return pages[path];
  if (/^\/creator\/(dashboard|inbox|requests|subscribers|earnings|analytics|profile|settings|payouts)$/.test(path)) return path.slice(1).replaceAll("/", "_");
  return "other";
}
export function readChoice(raw: string | null, now = Date.now()): boolean | null {
  try {
    const value = JSON.parse(raw || "null");
    return typeof value?.accepted === "boolean" && typeof value.at === "number" && value.at <= now && now - value.at < 180 * 86400000 ? value.accepted : null;
  } catch { return null; }
}
