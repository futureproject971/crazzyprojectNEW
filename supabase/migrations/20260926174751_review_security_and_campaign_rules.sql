-- Previously public grants on private wallet operations are unnecessary.
revoke execute on function public.admin_adjust_bonus(uuid,integer,text,text),public.get_my_bonus_wallet(),public.redeem_bonus(uuid,integer,text),public.get_bonus_catalog() from public,anon;
grant execute on function public.admin_adjust_bonus(uuid,integer,text,text),public.get_my_bonus_wallet(),public.redeem_bonus(uuid,integer,text),public.get_bonus_catalog() to authenticated;
-- Retain historical coupon awards while removing legacy coupon prizes from product campaigns.
update public.luck_prizes p set active=false from public.luck_campaigns c where p.campaign_id=c.id and c.mode in ('wheel','scratch') and p.prize_type not in ('product','none');
update public.luck_campaigns set description='Ganhe produtos e planos selecionados pela CRAZZY PROJECT.' where mode in ('wheel','scratch');
-- A plan is a draft while price is zero. Adding price + stock makes each new plan usable independently.
-- Existing explicit pauses remain untouched after the one-time reported-plan repair.
