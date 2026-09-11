import { MarketingPage } from "@/components/marketing-page";
import { pageMetadata } from "@/lib/metadata";
import { getViewer } from "@/lib/auth/session";
export const metadata = pageMetadata(
  "Get paid for your attention",
  "/creators",
  "Create your ReplyPass page, set your prices and bring your followers closer. Your people. Your pace.",
);
export default async function Creators() {
  const viewer = await getViewer();
  return <MarketingPage forCreators creatorAuthenticated={!!viewer} />;
}
