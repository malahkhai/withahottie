import { getViewer } from "@/lib/auth/session";
import { stripeConfig } from "@/lib/stripe/config";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import { siteConfig } from "@/lib/site";
import { notFound } from "next/navigation";
import { CreatorProfile } from "@/components/creator-profile";
import { ProfileViewTracker } from "@/components/profile-view-tracker";
import { findCreator } from "@/lib/creators/repository";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const creator = await findCreator((await params).handle);
  if (!creator)
    return {
      title: "Creator not found",
      robots: { index: false, follow: false },
    };
  return pageMetadata(
    creator.name,
    `/${creator.handle}`,
    `${creator.name} on ${siteConfig.name}. ${siteConfig.tagline} ${siteConfig.fanPromise}`,
  );
}
export default async function Profile({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ interaction?: string }>;
}) {
  const { handle } = await params;
  const { interaction } = await searchParams;
  let decoded = "";
  try {
    decoded = decodeURIComponent(handle);
  } catch {
    notFound();
  }
  if (!decoded.startsWith("@")) notFound();
  const creator = await findCreator(handle);
  if (!creator) notFound();
  return (
    <>
      {!creator.demo && <ProfileViewTracker creatorId={creator.id} />}
      <CreatorProfile
        key={`${handle}:${interaction || ""}`}
        initialInteraction={interaction}
        creator={creator}
        authenticated={!!(await getViewer())}
        paymentsEnabled={!!stripeConfig() && !creator.demo}
      />
    </>
  );
}
