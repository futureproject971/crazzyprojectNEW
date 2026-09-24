import { readFile } from "node:fs/promises";

const header = await readFile("src/core/app-shell/AppHeader.tsx","utf8");
const styles = await readFile("src/core/app-shell/styles.css","utf8");
const route = await readFile("src/app/api/admin/support/open-count/route.ts","utf8");

for (const required of [
  "openTicketCount",
  "/api/admin/support/open-count",
  "admin-open-ticket-badge",
  "support_tickets",
  "crz-shell-user__ticket-badge",
  'openTicketCount>99?"99+":openTicketCount',
]) {
  if (!header.includes(required)) throw new Error("Admin ticket badge header missing: "+required);
}

for (const required of [
  ".crz-shell-user__ticket-badge",
  "background: #ef3340",
  "border-radius: 999px",
  "bottom: -5px",
]) {
  if (!styles.includes(required)) throw new Error("Admin ticket badge styles missing: "+required);
}

for (const required of [
  '["open", "waiting_staff", "waiting_user"]',
  '.from("support_tickets")',
  '.in("status"',
  'supabase.rpc("is_current_admin")',
]) {
  if (!route.includes(required)) throw new Error("Admin open-ticket count API missing: "+required);
}

console.log("[PASS] admin profile shows realtime numeric open-ticket badge");
