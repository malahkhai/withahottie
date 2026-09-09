import { AuthForm } from "@/components/auth-form";
export const metadata = { title: "Become a creator" };
export default function Apply() {
  return (
    <main id="main" className="auth-page">
      <span className="eyebrow">FOR PEOPLE WITH PEOPLE</span>
      <h1>Your time. Valued.</h1>
      <p className="auth-description">
        Get paid for your attention. Build closer connections through messages,
        personal requests, and your own VIP community.
      </p>
      <AuthForm mode="apply" configured={false} />
    </main>
  );
}
