import { MarketingPage } from "@/components/marketing-page";
import { pageMetadata } from "@/lib/metadata";
export const metadata = pageMetadata(
  "Get paid for your attention",
  "/creators",
  "Create your ReplyPass page, set your prices and bring your followers closer. Your people. Your pace.",
);
export default function Creators() {
  return <MarketingPage forCreators />;
}
