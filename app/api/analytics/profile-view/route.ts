import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/session";
import { serviceDatabase } from "@/lib/stripe/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).host !== new URL(request.url).host)
      return NextResponse.json({ error: "Invalid origin." }, { status: 403 });

    const body = await request.json();
    if (typeof body.creatorId !== "string" || !uuid.test(body.creatorId))
      return NextResponse.json({ error: "Invalid creator." }, { status: 400 });

    const db = serviceDatabase();
    const { data: creator, error: creatorError } = await db
      .from("creator_profiles")
      .select("profile_id,onboarding_complete")
      .eq("id", body.creatorId)
      .maybeSingle();
    if (creatorError || !creator?.onboarding_complete)
      return NextResponse.json({ error: "Creator unavailable." }, { status: 404 });

    const viewer = await getViewer();
    if (viewer && !viewer.demo && viewer.id === creator.profile_id)
      return new NextResponse(null, { status: 204 });

    const { error } = await db.rpc("record_creator_profile_view", {
      target_creator: body.creatorId,
    });
    if (error)
      return NextResponse.json({ error: "Tracking unavailable." }, { status: 503 });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Tracking unavailable." }, { status: 503 });
  }
}
