"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export const SUPPORT_MAX_FILE_SIZE = 25 * 1024 * 1024;
export const SUPPORT_MAX_FILES_PER_MESSAGE = 5;

export const SUPPORT_ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/ogg",
  "audio/webm",
  "application/pdf",
  "text/plain",
]);

export const SUPPORT_FILE_ACCEPT = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/ogg",
  "audio/webm",
  "application/pdf",
  "text/plain",
].join(",");

export function validateSupportFile(file: File) {
  if (!SUPPORT_ALLOWED_MIME.has(file.type)) {
    return "Tipo de arquivo não permitido: " + (file.type || file.name);
  }
  if (file.size <= 0 || file.size > SUPPORT_MAX_FILE_SIZE) {
    return "O arquivo " + file.name + " deve ter no máximo 25 MB.";
  }
  return null;
}

export async function uploadSupportFile({
  ticketId,
  messageId,
  file,
}: {
  ticketId: string;
  messageId: string;
  file: File;
}) {
  const invalid = validateSupportFile(file);
  if (invalid) throw new Error(invalid);

  const createResponse = await fetch(
    "/api/support/" + ticketId + "/attachments/upload-url",
    {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message_id: messageId,
        filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      }),
    }
  );

  const signed = await createResponse.json();
  if (!createResponse.ok) {
    throw new Error(signed?.error || "Não foi possível preparar o anexo.");
  }

  const supabase = createBrowserSupabaseClient();
  const { error: uploadError } = await supabase.storage
    .from(signed.bucket)
    .uploadToSignedUrl(signed.path, signed.token, file, {
      contentType: file.type,
    });

  if (uploadError) throw uploadError;

  const finalizeResponse = await fetch(
    "/api/support/attachments/" + signed.attachmentId + "/finalize",
    {
      method: "POST",
      credentials: "same-origin",
    }
  );

  const finalized = await finalizeResponse.json();
  if (!finalizeResponse.ok) {
    throw new Error(finalized?.error || "O anexo subiu, mas não foi finalizado.");
  }

  return finalized;
}
