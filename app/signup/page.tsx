import { AuthForm } from "@/components/auth-form";
import { getSupabaseConfig } from "@/lib/supabase/config";
export const metadata = { title: "Join Withahottie" };
export default function Signup() {
  return (
    <main id="main" className="auth-page">
      <span className="eyebrow">MAKE YOURSELF AT HOME</span>
      <h1>A little closer.</h1>
      <p className="auth-description">
        Join your favorite creators for conversations that feel personal.
      </p>
      <AuthForm mode="signup" configured={!!getSupabaseConfig()} />
    </main>
  );
}
