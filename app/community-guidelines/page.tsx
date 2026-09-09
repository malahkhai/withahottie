import { DraftPolicy } from "@/components/draft-policy";
import { pageMetadata } from "@/lib/metadata";
export const metadata = pageMetadata(
  "Community guidelines",
  "/community-guidelines",
  "Draft community guidelines outline for ReplyPass. Pending review before production launch.",
  true,
);
export default function Page() {
  return (
    <DraftPolicy
      title="Community guidelines"
      topics={[
        "Respectful, brand-safe interactions and creator boundaries.",
        "Handling harassment, impersonation and unauthorized media.",
        "Reporting, moderation and review processes to be finalized.",
      ]}
    />
  );
}
