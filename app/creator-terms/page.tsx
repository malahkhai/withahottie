import { DraftPolicy } from "@/components/draft-policy";
import { pageMetadata } from "@/lib/metadata";
export const metadata = pageMetadata(
  "Creator terms",
  "/creator-terms",
  "Draft creator terms outline for ReplyPass. Pending review before production launch.",
  true,
);
export default function Page() {
  return (
    <DraftPolicy
      title="Creator terms"
      topics={[
        "Creator eligibility, availability and fulfillment responsibilities.",
        "Proposed platform fees, earnings, refunds and payout arrangements.",
        "Content permissions, account restrictions and marketplace responsibilities.",
      ]}
    />
  );
}
