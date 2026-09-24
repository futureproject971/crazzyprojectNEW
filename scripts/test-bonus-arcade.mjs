import fs from "node:fs/promises";
const migration=await fs.readFile("supabase/migrations/20260924172834_crazzy_bonus_arcade.sql","utf8");
for(const required of ["bonus_wallets","bonus_lots","bonus_transactions","bonus_plan_rules","bonus_redemptions","grant_purchase_bonus","redeem_bonus","monthly_limit_cents","allowed_plan_id"])if(!migration.includes(required))throw new Error("CRAZZY BONUS backend missing "+required);
const checkout=await fs.readFile("supabase/functions/_shared/checkout.ts","utf8");
for(const required of ["grant_purchase_bonus","allowed_plan_id","CRAZZY BONUS","transient bonus error can heal"])if(!checkout.includes(required))throw new Error("Checkout BONUS integration missing "+required);
const bonus=await fs.readFile("src/modules/bonus/BonusPage.tsx","utf8");if(!bonus.includes("Não é sacável")||!bonus.includes("Gerar benefício"))throw new Error("BONUS rules/UX incomplete");
const admin=await fs.readFile("src/modules/bonus-manager/BonusManagerPage.tsx","utf8");if(!admin.includes("maxBonusPercent")||!admin.includes("monthlyLimitCents"))throw new Error("BONUS admin controls incomplete");
console.log("[PASS] CRAZZY BONUS wallet, purchase grants, redemption limits and admin controls");

const finalize=await fs.readFile("supabase/migrations/20260924174400_bonus_arcade_finalize.sql","utf8");
for(const required of [
  "luck_prizes_prize_type_check",
  "'bonus'::text",
  "on_order_ticket_purchase_bonus",
  "trg_order_ticket_purchase_bonus",
  "status in ('FULFILLING','COMPLETED')",
  "private.bonus_credit"
]) if(!finalize.includes(required)) throw new Error("BONUS/ARCADE finalize migration missing "+required);
