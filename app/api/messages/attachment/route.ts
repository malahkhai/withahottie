import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { sameOrigin, fail } from "@/lib/http";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail("Invalid origin.", 403);
  const viewer = await getViewer();
  if (!viewer || viewer.demo) return fail("Sign in required.", 401);
  if (Number(request.headers.get("content-length")) > 3 * 1024 * 1024)
    return fail("Choose an image under 1 MB.", 413);
  const form = await request.formData();
  const file = form.get("image");
  const conversation = String(form.get("conversationId"));
  const content = String(form.get("body") || "Shared an image");
  if (
    !(file instanceof File) ||
    file.size > 1024 * 1024 ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    !/^[0-9a-f-]{36}$/.test(conversation)
  )
    return fail("Choose a JPG, PNG or WebP under 1 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const valid =
    file.type === "image/jpeg"
      ? bytes[0] === 255 && bytes[1] === 216
      : file.type === "image/png"
        ? bytes[0] === 137 && bytes[1] === 80
        : String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!valid) return fail("Invalid image format.");
  const client = (await createClient())!;
  const path = `${conversation}/${viewer.id}/${crypto.randomUUID()}`;
  const { error: uploadError } = await client.storage
    .from("chat-attachments")
    .upload(path, bytes, { contentType: file.type });
  if (uploadError)
    return fail("Upload failed or conversation unavailable.", 403);
  const { data, error } = await client.rpc("send_chat_attachment", {
    conversation,
    content,
    object_path: path,
    mime: file.type,
    bytes: file.size,
  });
  if (error) {
    await client.storage.from("chat-attachments").remove([path]);
    return fail("Unable to send the attachment.", 403);
  }
  return NextResponse.json({ id: data });
}
