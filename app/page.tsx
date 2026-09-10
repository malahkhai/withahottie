import { MarketingPage } from "@/components/marketing-page";
import { pageMetadata } from "@/lib/metadata";
import { siteConfig } from "@/lib/site";
export const metadata = pageMetadata(
  "Get closer to the people you follow",
  "/",
  siteConfig.description,
);
export default function Home() {
  return <MarketingPage />;
}
