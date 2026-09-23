import { NextRequest, NextResponse } from "next/server";
import { proxySupportJson, supportAuthHeader, supportEdgeUrl } from "@/app/api/support/_shared";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function isAdmin() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, admin: false };
  const { data, error } = await supabase.rpc("is_current_admin");
  return { user, admin: !error && data === true };
}

export async function GET(request: NextRequest) {
  const context = await isAdmin();
  if (!context.user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (!context.admin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const authorization = await supportAuthHeader();
  if (!authorization) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const response = await fetch(
    supportEdgeUrl("staff-snapshot", {
      q: request.nextUrl.searchParams.get("q"),
      status: request.nextUrl.searchParams.get("status"),
      priority: request.nextUrl.searchParams.get("priority"),
    }),
    { cache: "no-store", headers: { Accept: "application/json", Authorization: authorization } }
  );

  const proxied = await proxySupportJson(response);
  return NextResponse.json(proxied.body, { status: proxied.status, headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  const context = await isAdmin();
  if (!context.user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (!context.admin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const authorization = await supportAuthHeader();
  if (!authorization) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const ticketId = String(body?.ticketId || "");
  if (!/^[0-9a-f-]{36}$/i.test(ticketId)) return NextResponse.json({ error: "INVALID_TICKET" }, { status: 400 });

  const response = await fetch(supportEdgeUrl("staff-update"), {
    method: "POST",
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: authorization },
    body: JSON.stringify({
      ticket_id: ticketId,
      status: body?.status,
      priority: body?.priority,
      assignee: body?.assignee,
    }),
  });

  const proxied = await proxySupportJson(response);
  return NextResponse.json(proxied.body, { status: proxied.status, headers: { "Cache-Control": "private, no-store" } });
}
