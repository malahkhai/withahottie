import {stripeConfig} from '@/lib/stripe/config';
import { NextResponse } from "next/server";
import { findCreator } from "@/lib/creators/repository";
import { demoQuote } from "@/lib/payments/demo";
export async function POST(request: Request) {
  // Stateless: no Stripe calls, financial records or charges.
  // Next may normalize request.url to localhost; Host preserves the browser-facing host.
  const requestUrl = new URL(request.url);
  const expectedOrigin = `${requestUrl.protocol}//${request.headers.get("host") || requestUrl.host}`;
  if (
    request.headers.get("origin") &&
    request.headers.get("origin") !== expectedOrigin
  )
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const raw = await request.text();
  if (raw.length > 10000)
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  try {
    const input = JSON.parse(raw);
    if(input?.kind==="message" && stripeConfig()) return NextResponse.json({error:"Use the secured reply checkout."},{status:409});
    const creator = await findCreator(
      typeof input?.handle === "string" ? input.handle : "@stella",
    );
    const offering = creator
      ? [...creator.offerings, ...(creator.vip ? [creator.vip] : [])].find(
          (p) => p.kind === input.kind,
        )
      : null;
    if (!offering)
      return NextResponse.json(
        { error: "This offering is unavailable." },
        { status: 400 },
      );
    const quote = demoQuote(input, offering.cents);
    if (!quote)
      return NextResponse.json(
        { error: "Check your request and try again." },
        { status: 400 },
      );
    return NextResponse.json(quote, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
