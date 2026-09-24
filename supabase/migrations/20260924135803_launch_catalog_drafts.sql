-- CRAZZY PROJECT launch catalog drafts
-- Real product names already defined by the owner. Products remain inactive until
-- plans, prices, delivery mode and stock are explicitly configured.

insert into public.games(name,slug,active,sort_order,emoji,accent_color)
values
  ('Valorant','valorant',true,10,'🎯','#0000FF'),
  ('FiveM','fivem',true,20,'🚗','#0000FF'),
  ('Rust','rust',true,30,'☢️','#0000FF')
on conflict (slug) do nothing;

insert into public.products(
  game_id,name,slug,description,is_new,active,sort_order,status,status_label,accent_color
)
select g.id,v.name,v.slug,v.description,true,false,v.sort_order,'offline','Aguardando configuração','#0000FF'
from (
  values
    ('valorant','AIM COLOR SLOTTED','valorant-aim-color-slotted','Produto CRAZZY PROJECT. Configure planos, preço, entrega e estoque antes de ativar.',10),
    ('valorant','VANGUARD EMULATOR','valorant-vanguard-emulator','Produto CRAZZY PROJECT. Configure planos, preço, entrega e estoque antes de ativar.',20),
    ('valorant','SKIN CHANGER','valorant-skin-changer','Produto CRAZZY PROJECT. Configure planos, preço, entrega e estoque antes de ativar.',30),
    ('valorant','UNBAN PERM','valorant-unban-perm','Produto CRAZZY PROJECT. Configure plano, preço e modo de entrega antes de ativar.',40),
    ('fivem','ROCKSTAR FAST','fivem-rockstar-fast','Produto CRAZZY PROJECT. Configure planos, preço, entrega e estoque antes de ativar.',50),
    ('fivem','SPOOFER FIVEM FAST','fivem-spoofer-fast','Produto CRAZZY PROJECT. Configure planos, preço, entrega e estoque antes de ativar.',60),
    ('fivem','CRUSH EXTERNAL + BYPASS','fivem-crush-external-bypass','Produto CRAZZY PROJECT. Configure planos, preço, entrega e estoque antes de ativar.',70),
    ('fivem','WG EXTERNAL','fivem-wg-external','Produto CRAZZY PROJECT. Configure planos, preço, entrega e estoque antes de ativar.',80),
    ('rust','RUST UNBAN PERM','rust-unban-perm','Produto CRAZZY PROJECT. Configure plano, preço e modo de entrega antes de ativar.',90)
) as v(game_slug,name,slug,description,sort_order)
join public.games g on g.slug=v.game_slug
on conflict (slug) do nothing;
