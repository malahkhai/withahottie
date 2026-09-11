import { ResetPasswordForm } from "@/components/password-recovery";
import { pageMetadata } from "@/lib/metadata";
import { siteConfig } from "@/lib/site";
import { getSupabaseConfig } from "@/lib/supabase/config";

export const metadata = pageMetadata("Choose a new password", "/reset-password", siteConfig.description, true);

export default function ResetPassword() {
  return (
    <main id="main" className="auth-page">
      <span className="eyebrow">ACCOUNT RECOVERY</span>
      <h1>Choose a new password.</h1>
      <p className="auth-description">Use at least 12 characters.</p>
      <ResetPasswordForm configured={!!getSupabaseConfig()} />
    </main>
  );
}
