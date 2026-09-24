import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_current_admin");
  if (adminError || isAdmin !== true) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "INVALID_UPLOAD" }, { status: 400 });
  }

  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 400 });
  }

  const extension = ALLOWED_TYPES.get(file.type);
  if (!extension) {
    return NextResponse.json({ error: "UNSUPPORTED_IMAGE_TYPE" }, { status: 400 });
  }

  const path = `product-cover/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from("site-branding")
    .upload(path, bytes, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    return NextResponse.json({ error: "UPLOAD_FAILED" }, { status: 400 });
  }

  const { data } = supabase.storage.from("site-branding").getPublicUrl(path);

  return NextResponse.json({
    url: data.publicUrl,
    path,
  }, { status: 201 });
}
