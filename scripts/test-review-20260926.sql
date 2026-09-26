begin;
do $$
declare u uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); prize uuid:=gen_random_uuid(); product uuid; plan uuid; stock uuid; result jsonb; again jsonb; failed boolean:=false; before_count integer;
begin
 if has_function_privilege('anon','public.play_luck(text,text)','execute') then raise exception 'anonymous play grant'; end if;
 if has_function_privilege('authenticated','public.reserve_voice_room(text,text,text,integer)','execute') then raise exception 'public voice worker grant'; end if;
 if has_function_privilege('authenticated','public.record_activity_xp(text,text,boolean,boolean)','execute') then raise exception 'public XP mint grant'; end if;
 insert into auth.users(id,aud,role,email) values(u,'authenticated','authenticated','review-'||substr(u::text,1,8)||'@example.invalid');
 perform set_config('request.jwt.claim.sub',u::text,true);
 select pp.id,pp.product_id into plan,product from public.product_plans pp join private.product_plan_operations op on op.product_plan_id=pp.id where op.delivery_mode='internal_stock' and pp.archived_at is null limit 1;
 insert into public.stock_items(product_plan_id,content,created_at) values(plan,'REVIEW-FIXTURE-'||u::text,'2000-01-01') returning id into stock;
 insert into public.luck_campaigns(id,slug,mode,title,active,bonus_cost_cents,daily_group) values(c,'review-'||u::text,'drop','Review fixture',true,0,'daily-free-drop');
 insert into public.luck_prizes(id,campaign_id,label,prize_type,weight,sort_order,config) values(prize,c,'Fixture plan','product',1,0,jsonb_build_object('product_id',product,'product_plan_id',plan));
 result:=public.play_luck('review-'||u::text,'review-idempotency-key');
 again:=public.play_luck('review-'||u::text,'review-idempotency-key');
 if result->>'play_id' is distinct from again->>'play_id' then raise exception 'idempotency failure';end if;
 if (select count(*) from public.library_deliveries where user_id=u)<>1 then raise exception 'delivery missing or duplicated';end if;
 if not (select used from public.stock_items where id=stock) then raise exception 'key not consumed';end if;
 if not exists(select 1 from public.entitlements where user_id=u and product_plan_id=plan and tutorial_access) then raise exception 'tutorial entitlement missing';end if;
 if not exists(select 1 from private.library_delivery_secrets s join public.library_deliveries d on d.id=s.delivery_id where d.user_id=u and s.payload='REVIEW-FIXTURE-'||u::text) then raise exception 'secure key missing';end if;
 begin perform public.play_luck('review-'||u::text,'different-idempotency-key');exception when others then if sqlerrm like '%DAILY_DROP_USED%' then failed:=true;else raise;end if;end;
 if not failed then raise exception 'daily drop bypass';end if;
 if exists(select 1 from public.bonus_transactions where user_id=u) then raise exception 'free play changed wallet';end if;
end $$;
select 'PASS: grants, free draw, automatic key delivery, tutorial, idempotency, daily limit, no wallet debit' result;
rollback;
