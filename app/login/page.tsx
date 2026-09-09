import { AuthForm } from "@/components/auth-form";
import { getSupabaseConfig } from "@/lib/supabase/config";
export const metadata = { title: "Log in" };
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main id="main" className="auth-page">
      <span className="eyebrow">YOUR PEOPLE ARE HERE</span>
      <h1>Hey, you’re back.</h1>
      <p className="auth-description">
        A good conversation is only a hello away.
      </p>
      {error === "confirmation" && (
        <p className="form-error" role="alert">
          That confirmation link has expired or is invalid. Please sign in or
          request a new confirmation email from your account provider.
        </p>
      )}
      <AuthForm mode="login" configured={!!getSupabaseConfig()} />
    </main>
  );
}
