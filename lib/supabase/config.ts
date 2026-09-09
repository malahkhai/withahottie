export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url && !key) return null;
  if (!url || !key) throw Error("Both Supabase URL and anon key are required.");
  // This module is imported by browser code. Reject privileged keys before use.
  let role: unknown;
  try {
    role = JSON.parse(
      atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    ).role;
  } catch {
    /* Publishable keys need not be JWTs. */
  }
  if (key.startsWith("sb_secret_") || role === "service_role")
    throw Error(
      "Use a Supabase anon or publishable key, never a privileged secret key.",
    );
  const parsed = new URL(url);
  if (!["https:", "http:"].includes(parsed.protocol) || key.length < 20)
    throw Error("Invalid Supabase configuration.");
  return { url, key };
}
