/** Public brand configuration only. Never put secrets in this module. */
export function normalizeAppUrl(value: string) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL must be an HTTP(S) origin without a path or credentials.",
    );
  }
  if (
    url.protocol !== "https:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  )
    throw new Error("Public application URLs must use HTTPS.");
  return url.origin;
}
const domain = "getreplypass.com";
export const siteConfig = {
  name: "ReplyPass",
  logo: "replypass",
  domain,
  url: normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL || `https://${domain}`),
  title: "ReplyPass — Get closer to the people you follow",
  description:
    "Message, chat and connect directly with your favorite creators. No reply, no charge.",
  tagline: "A little closer to the people you follow.",
  creatorProposition: "Get paid for your attention.",
  fanPromise: "No reply = no charge.",
} as const;
export function creatorUrl(handle: string) {
  const username = handle.replace(/^@/, "");
  if (!/^[a-z0-9_]{3,30}$/.test(username))
    throw new Error("Invalid creator username.");
  return `${siteConfig.url}/@${username}`;
}
/** Local auth stays local even when sharing/metadata use the production URL. */
export function authOrigin(observedOrigin: string) {
  const url = new URL(observedOrigin);
  return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    ? normalizeAppUrl(url.origin)
    : siteConfig.url;
}
