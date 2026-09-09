import { pageMetadata } from "@/lib/metadata";
import { siteConfig } from "@/lib/site";
import { AuthForm } from "@/components/auth-form";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { safeNext } from "@/lib/auth/paths";
export const metadata = pageMetadata("Join", "/signup", siteConfig.description, true);
export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const q = await searchParams;
  return (
    <main id="main" className="auth-page">
      <span className="eyebrow">MAKE A CONNECTION</span>
      <h1>Your people. Closer.</h1>
      <p className="auth-description">
        A better way to reach the people who inspire you.
      </p>
      <AuthForm
        mode="signup"
        configured={!!getSupabaseConfig()}
        next={safeNext(q.next)}
      />
    </main>
  );
}
