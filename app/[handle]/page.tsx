import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreatorProfile } from "@/components/creator-profile";
import { findCreator } from "@/lib/creators/repository";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const creator = await findCreator((await params).handle);
  return {
    title: creator ? creator.name : "Creator not found",
    description: creator
      ? `${creator.name} on ReplyPass. A little closer to the people you follow. No reply = no charge.`
      : "Find your next conversation on ReplyPass.",
  };
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
  return <CreatorProfile creator={creator} />;
}
