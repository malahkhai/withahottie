import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreatorProfile } from "@/components/creator-profile";
// Normalize the encoded @ segment delivered by the route matcher.
function isStella(handle: string) {
  try {
    return decodeURIComponent(handle) === "@stella";
  } catch {
    return false;
  }
}
export function generateStaticParams() {
  return [{ handle: "@stella" }];
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  return isStella((await params).handle)
    ? {
        title: "Stella May",
        description:
          "Come talk to Stella May. Guaranteed replies, live chats and a little more connection. No reply = no charge.",
      }
    : { title: "Creator not found" };
}
export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  if (!isStella((await params).handle)) notFound();
  return <CreatorProfile />;
}
