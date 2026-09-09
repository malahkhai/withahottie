import { AuthForm } from "@/components/auth-form";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { safeNext } from "@/lib/auth/paths";
export const metadata = { title: "Log in" };
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
      <p className="auth-description">
        A little closer to the people you follow.
      </p>
      {q.error && (
        <p className="form-error" role="alert">
          That confirmation link is invalid or expired. Please sign in or sign
          up again for a fresh link.
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
