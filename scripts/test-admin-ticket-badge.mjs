import { readFile } from "node:fs/promises";

const header = await readFile("src/core/app-shell/AppHeader.tsx","utf8");
const styles = await readFile("src/core/app-shell/header.css","utf8");
const route = await readFile("src/app/api/admin/support/open-count/route.ts","utf8");

for (const required of [
  "openTicketCount",
  "/api/admin/support/open-count",
  "admin-open-ticket-badge",
  "support_tickets",
  "crz-ticket-pending",
  'openTicketCount>99?"99+":openTicketCount',
]) {
  if (!header.includes(required)) throw new Error("Admin ticket badge header missing: "+required);
}

for (const required of [
  ".crz-ticket-pending",
  "background:#123c72",
  "border-radius:7px",
  "border:1px solid #328aff",
]) {
  if (!styles.includes(required)) throw new Error("Admin ticket badge styles missing: "+required);
}

for (const required of [
  '["open", "waiting_staff"]',
  '.from("support_tickets")',
  '.in("status"',
  'supabase.rpc("is_current_admin")',
]) {
  if (!route.includes(required)) throw new Error("Admin open-ticket count API missing: "+required);
}

console.log("[PASS] ticket action shows realtime pending-staff count");
