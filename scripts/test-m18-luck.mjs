import fs from "node:fs/promises";
const migration=await fs.readFile("supabase/migrations/20260924172834_crazzy_bonus_arcade.sql","utf8");
for(const required of ["bonus_cost_cents","private.bonus_debit","BONUS_BALANCE_LOW","prize_type='bonus'","drop function if exists public.play_luck(text,text,uuid)"])if(!migration.includes(required))throw new Error("Arcade bonus migration missing "+required);
const page=await fs.readFile("src/modules/luck/LuckPage.tsx","utf8");
for(const required of ["crz-pink-grid","canvas","/api/bonus","CRAZZY BONUS","CRAZZY SCRATCH"])if(!page.includes(required))throw new Error("PINK-derived Arcade UI missing "+required);
for(const forbidden of ["paymentId","Gerar pagamento da jogada","cart_snapshot:[{type:\"luck-play\""])if(page.includes(forbidden))throw new Error("Paid Luck flow returned: "+forbidden);
const api=await fs.readFile("src/app/api/luck/route.ts","utf8");if(api.includes("p_payment_id"))throw new Error("Arcade API must not accept direct payment");
const checkout=await fs.readFile("supabase/functions/_shared/checkout.ts","utf8");if(!checkout.includes("Jogadas do CRAZZY ARCADE usam somente CRAZZY BONUS"))throw new Error("Checkout must reject direct-paid Arcade carts");
console.log("[PASS] M18 CRAZZY ARCADE uses promotional BONUS and PINK scratch UI");
