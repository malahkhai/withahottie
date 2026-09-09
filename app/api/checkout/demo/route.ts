import { NextResponse } from "next/server";
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
    const quote = demoQuote(JSON.parse(raw));
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
