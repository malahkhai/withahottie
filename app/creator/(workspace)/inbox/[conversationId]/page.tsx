import { ConversationPage } from "@/components/creator-workspace";
export const metadata = { title: "Conversation" };
export default async function Page({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  return <ConversationPage id={(await params).conversationId} />;
}
