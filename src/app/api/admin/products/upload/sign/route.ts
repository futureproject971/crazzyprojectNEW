import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const ALLOWED = new Set(["image/png","image/jpeg","image/webp","image/gif","video/mp4","video/webm"]);

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_current_admin");
  if (adminError || isAdmin !== true) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const contentType = String(body?.contentType || "").toLowerCase();
  const kind = ["icon","banner","gallery","video"].includes(String(body?.kind || "").toLowerCase()) ? String(body.kind).toLowerCase() : "";
  if (!kind || !ALLOWED.has(contentType)) return NextResponse.json({ error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 400 });
  if (kind === "video" && !contentType.startsWith("video/")) return NextResponse.json({ error: "VIDEO_REQUIRED" }, { status: 400 });
  if (kind !== "video" && !contentType.startsWith("image/")) return NextResponse.json({ error: "IMAGE_REQUIRED" }, { status: 400 });

  const size = Number(body?.size);
  const maxSize = (kind === "video" ? 48 : 10) * 1024 * 1024;
  if(!Number.isInteger(size)||size<=0||size>maxSize) return NextResponse.json({error:"FILE_TOO_LARGE"},{status:400});

  const ext = contentType === "video/mp4" ? "mp4"
    : contentType === "video/webm" ? "webm"
    : contentType === "image/png" ? "png"
    : contentType === "image/jpeg" ? "jpg"
    : contentType === "image/gif" ? "gif" : "webp";
  const path = `product-media/${kind}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const { data, error } = await supabase.storage.from("site-branding").createSignedUploadUrl(path);
  if (error || !data?.token) return NextResponse.json({ error: "SIGNED_UPLOAD_FAILED" }, { status: 400 });

  const publicUrl = supabase.storage.from("site-branding").getPublicUrl(path).data.publicUrl;
  return NextResponse.json({ path, token: data.token, url: publicUrl });
}

