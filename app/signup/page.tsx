import { pageMetadata } from "@/lib/metadata";
import { siteConfig } from "@/lib/site";
import { AuthForm } from "@/components/auth-form";
import { getSupabaseConfig } from "@/lib/supabase/config";
import Link from "next/link";
import { findCreator } from "@/lib/creators/repository";
import {
  safeNext,
  signupAllowed,
  isCreatorDestination,
} from "@/lib/auth/paths";
export const metadata = pageMetadata(
  "Join",
  "/signup",
  siteConfig.description,
  true,
);
export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const q = await searchParams;
  const creator = isCreatorDestination(q.next)
    ? await findCreator(q.next.split("?")[0].slice(1))
    : null;
  if (!signupAllowed(q.next) || (isCreatorDestination(q.next) && !creator))
    return (
      <main id="main" className="auth-page">
        <span className="eyebrow">START WITH YOUR PEOPLE</span>
        <h1>A connection starts with a creator.</h1>
        <p className="auth-description">
          Following someone? Open their ReplyPass link to message them and
          create your account along the way.
        </p>
        <Link className="button" href="/creators">
          I’m a creator
        </Link>
        <p className="auth-switch">
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </main>
    );
  return (
    <main id="main" className="auth-page">
      <span className="eyebrow">MAKE A CONNECTION</span>
      <h1>
        {creator
          ? `Get closer to ${creator.name.split(" ")[0]}.`
          : "Your people. Closer."}
      </h1>
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
