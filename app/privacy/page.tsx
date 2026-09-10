import { DraftPolicy } from "@/components/draft-policy";
import { pageMetadata } from "@/lib/metadata";
export const metadata = pageMetadata(
  "Privacy",
  "/privacy",
  "Draft privacy outline for ReplyPass. Pending review before production launch.",
  true,
);
export default function Page() {
  return (
    <DraftPolicy
      title="Privacy"
      topics={[
        "Data collected for accounts, messages and creator requests.",
        "Optional Google Analytics loads only after you accept analytics cookies. It measures page groups and product interactions. Advertising storage and personalization remain disabled. Change or withdraw your choice using Cookie preferences in the footer. Your choice is remembered in this browser for up to 180 days.",
        "Analytics events exclude message contents, names, email addresses, creator handles, private record IDs and URL queries. Google may process device and usage information when analytics is enabled.",
        "Service providers, storage, retention and deletion practices to be confirmed.",
        "Privacy contacts and applicable user-request processes.",
      ]}
    />
  );
}
