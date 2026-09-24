import { readFile } from "node:fs/promises";

const customer = await readFile("src/modules/support/TicketThreadPage.tsx","utf8");
const staff = await readFile("src/modules/support-desk/SupportDeskPage.tsx","utf8");
const migration = await readFile("supabase/migrations/20260924224200_m13_support_realtime.sql","utf8");

for (const required of [
  "createBrowserSupabaseClient",
  "support_messages",
  "support_attachments",
  "support_ticket_events",
  "support_tickets",
  "scheduleRealtimeRefresh",
  "optimisticMessage",
]) {
  if (!customer.includes(required)) throw new Error("Customer realtime missing: "+required);
}
if (customer.includes("}, 6000)")) throw new Error("Old 6-second polling still present");
console.log("[PASS] customer ticket is realtime and optimistic");

for (const required of [
  "createBrowserSupabaseClient",
  "support-desk-live",
  "optimisticMessage",
  "refreshThread",
  "messagesRef",
]) {
  if (!staff.includes(required)) throw new Error("Staff realtime missing: "+required);
}
if (staff.includes("await loadThread(selected)")) throw new Error("Staff still reloads whole thread after send");
console.log("[PASS] staff desk updates without thread reload");

for (const table of [
  "support_messages",
  "support_tickets",
  "support_attachments",
  "support_ticket_events",
]) {
  const expected="alter publication supabase_realtime add table public."+table;
  if (!migration.includes(expected)) throw new Error("Realtime publication missing "+table);
}
console.log("[PASS] support realtime publication is versioned");
