import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/session";
import { fail, sameOrigin } from "@/lib/http";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail("Invalid origin.", 403);
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in first.", 401);
  const supabase = await createClient();
  if (!supabase) return fail("Demo images are saved in this browser.", 400);
  if (Number(request.headers.get("content-length")) > 3 * 1024 * 1024)
    return fail("Choose an image under 2 MB.", 413);
  const form = await request.formData();
  const file = form.get("image");
  if (
    !(file instanceof File) ||
    file.size > 2 * 1024 * 1024 ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type)
  )
    return fail("Choose a JPG, PNG or WebP under 2 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const valid =
    file.type === "image/jpeg"
      ? bytes[0] === 255 && bytes[1] === 216
      : file.type === "image/png"
        ? bytes[0] === 137 && bytes[1] === 80
        : String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!valid) return fail("The image format does not match the file.");
  const path = `${viewer.id}/${crypto.randomUUID()}`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (error) return fail("Image upload failed. Please try again.", 503);
  return NextResponse.json({
    url: supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl,
  });
}
