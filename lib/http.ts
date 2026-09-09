import { NextResponse } from "next/server";
export function sameOrigin(request: Request) {
  const url = new URL(request.url);
  const expected = `${url.protocol}//${request.headers.get("host") || url.host}`;
  return (
    !request.headers.get("origin") || request.headers.get("origin") === expected
  );
}
export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
export async function readJson(request: Request) {
  if (!sameOrigin(request)) throw Error("Invalid origin.");
  const raw = await request.text();
  if (raw.length > 16000) throw Error("Request too large.");
  return JSON.parse(raw);
}
