import { pageMetadata } from "@/lib/metadata";
import { siteConfig } from "@/lib/site";
import { AuthForm } from "@/components/auth-form";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { safeNext } from "@/lib/auth/paths";
export const metadata = pageMetadata(
  "Log in",
  "/login",
  siteConfig.description,
  true,
);
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const q = await searchParams;
  return (
    <main id="main" className="auth-page">
      <span className="eyebrow">YOUR PEOPLE ARE HERE</span>
      <h1>Good to see you.</h1>
      <p className="auth-description">{siteConfig.tagline}</p>
      {q.error && (
        <p className="form-error" role="alert">
          We couldn’t finish automatic sign-in. If you confirmed your email, log
          in below to continue. Open confirmation links in the same browser you
          used to sign up.
        </p>
      )}
      <AuthForm
        mode="login"
        configured={!!getSupabaseConfig()}
        next={safeNext(q.next)}
      />
    </main>
  );
}
