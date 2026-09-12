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
  searchParams: Promise<{ next?: string; error?: string; password?: string }>;
}) {
  const q = await searchParams;
  return (
    <main id="main" className="auth-page">
      <span className="eyebrow">YOUR PEOPLE ARE HERE</span>
      <h1>Good to see you.</h1>
      <p className="auth-description">{siteConfig.tagline}</p>
      {q.error && (
        <p className="form-error" role="alert">
          Your email may already be confirmed, but automatic sign-in could not
          finish in this browser. Return to the browser where you signed up and
          log in with your new account to continue.
        </p>
      )}
      {q.password === "updated" && (
        <p className="form-success" role="status">
          Your password has been updated. Log in with your new password.
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
