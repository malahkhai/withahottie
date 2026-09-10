import {stripeConfig} from '@/lib/stripe/config';
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import { siteConfig } from "@/lib/site";
import { notFound } from "next/navigation";
import { CreatorProfile } from "@/components/creator-profile";
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
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  let decoded = "";
  try {
    decoded = decodeURIComponent(handle);
  } catch {
    notFound();
  }
  if (!decoded.startsWith("@")) notFound();
  const creator = await findCreator(handle);
  if (!creator) notFound();
  return <CreatorProfile creator={creator} paymentsEnabled={!!stripeConfig()} />;
}
