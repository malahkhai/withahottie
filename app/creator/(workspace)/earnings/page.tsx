import {requireRole} from '@/lib/auth/session';
import {stripeConfig} from '@/lib/stripe/config';
import {paymentSummaries} from '@/lib/stripe/summaries';
import {SecuredEarnings} from '@/components/secured-earnings';
import { EarningsPage } from "@/components/creator-workspace";
export const metadata = { title: "Earnings" };
export default async function Page() {
 const viewer=await requireRole(["creator","admin"]);
 if(!viewer.demo&&stripeConfig())return <SecuredEarnings rows={await paymentSummaries(viewer.id,"creator")}/>;
  return <EarningsPage />;
}
