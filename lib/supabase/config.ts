export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url && !key) return null;
  if (!url || !key) throw Error("Both Supabase URL and anon key are required.");
  const parsed = new URL(url);
  if (!["https:", "http:"].includes(parsed.protocol) || key.length < 20)
    throw Error("Invalid Supabase configuration.");
  return { url, key };
}
