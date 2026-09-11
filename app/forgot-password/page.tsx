import { ForgotPasswordForm } from "@/components/password-recovery";
import { pageMetadata } from "@/lib/metadata";
import { siteConfig } from "@/lib/site";
import { getSupabaseConfig } from "@/lib/supabase/config";

export const metadata = pageMetadata("Reset your password", "/forgot-password", siteConfig.description, true);

export default function ForgotPassword() {
  return (
    <main id="main" className="auth-page">
      <span className="eyebrow">ACCOUNT RECOVERY</span>
      <h1>Reset your password.</h1>
      <p className="auth-description">We’ll email you a secure reset link.</p>
      <ForgotPasswordForm configured={!!getSupabaseConfig()} />
    </main>
  );
}
