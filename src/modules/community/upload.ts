"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export const COMMUNITY_MAX_FILE_SIZE = 20 * 1024 * 1024;
export const COMMUNITY_MAX_FILES = 4;

export const COMMUNITY_ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/ogg",
  "audio/webm",
]);

export const COMMUNITY_FILE_ACCEPT = [...COMMUNITY_ALLOWED_MIME].join(",");

export function validateCommunityFile(file: File) {
  if (!COMMUNITY_ALLOWED_MIME.has(file.type)) {
    return "Tipo de mídia não permitido: " + (file.type || file.name);
  }

  if (file.size <= 0 || file.size > COMMUNITY_MAX_FILE_SIZE) {
    return "A mídia " + file.name + " deve ter no máximo 20 MB.";
  }

  return null;
}

export async function uploadCommunityFile({
  messageId,
  file,
}: {
  messageId: string;
  file: File;
}) {
  const invalid = validateCommunityFile(file);
  if (invalid) throw new Error(invalid);

  const createResponse = await fetch(
    "/api/community/messages/" + messageId + "/attachments/upload-url",
    {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      }),
    }
  );

  const signed = await createResponse.json();
  if (!createResponse.ok) {
    throw new Error(signed?.error || "Não foi possível preparar a mídia.");
  }

  const supabase = createBrowserSupabaseClient();
  const { error: uploadError } = await supabase.storage
    .from(signed.bucket)
    .uploadToSignedUrl(signed.path, signed.token, file, {
      contentType: file.type,
    });

  if (uploadError) throw uploadError;

  const finalizeResponse = await fetch(
    "/api/community/attachments/" + signed.attachmentId + "/finalize",
    {
      method: "POST",
      credentials: "same-origin",
    }
  );

  const finalized = await finalizeResponse.json();
  if (!finalizeResponse.ok) {
    throw new Error(finalized?.error || "A mídia subiu, mas não foi finalizada.");
  }

  return finalized;
}
