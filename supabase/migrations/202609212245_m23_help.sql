-- M23 CRAZZY HELP
-- Public help search over curated FAQs and public Academy tutorials.

create table if not exists public.help_faqs (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'Geral',
  question text not null,
  answer text not null,
  keywords text[] not null default '{}'::text[],
  featured boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists help_faqs_active_sort_idx
  on public.help_faqs(active, featured desc, sort_order);

alter table public.help_faqs enable row level security;

drop policy if exists "Admins manage help faqs" on public.help_faqs;
create policy "Admins manage help faqs"
on public.help_faqs for all to authenticated
using (private.has_role(auth.uid(),'admin'::app_role))
with check (private.has_role(auth.uid(),'admin'::app_role));

create or replace function public.get_help_content(
  p_query text default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth,pg_temp
stable
as $$
declare
  v_query text := lower(btrim(coalesce(p_query,'')));
  v_limit integer := greatest(1,least(coalesce(p_limit,50),100));
  v_faqs jsonb;
  v_tutorials jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',x.id,
    'category',x.category,
    'question',x.question,
    'answer',x.answer,
    'featured',x.featured,
    'sort_order',x.sort_order,
    'score',x.score
  ) order by x.score desc,x.featured desc,x.sort_order,x.question),'[]'::jsonb)
  into v_faqs
  from (
    select
      f.*,
      case
        when v_query='' then 1
        when lower(f.question)=v_query then 100
        when lower(f.question) like '%' || v_query || '%' then 70
        when lower(f.answer) like '%' || v_query || '%' then 40
        when exists (
          select 1 from unnest(f.keywords) k
          where lower(k) like '%' || v_query || '%'
        ) then 55
        when lower(f.category) like '%' || v_query || '%' then 25
        else 0
      end as score
    from public.help_faqs f
    where f.active=true
      and (
        v_query=''
        or lower(f.question) like '%' || v_query || '%'
        or lower(f.answer) like '%' || v_query || '%'
        or lower(f.category) like '%' || v_query || '%'
        or exists (
          select 1 from unnest(f.keywords) k
          where lower(k) like '%' || v_query || '%'
        )
      )
    order by score desc,f.featured desc,f.sort_order,f.question
    limit v_limit
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',x.id,
    'slug',x.slug,
    'title',x.title,
    'subtitle',x.subtitle,
    'summary',x.summary,
    'category',x.category,
    'estimated_minutes',x.estimated_minutes,
    'featured',x.featured,
    'cover_url',x.cover_url,
    'score',x.score
  ) order by x.score desc,x.featured desc,x.sort_order,x.title),'[]'::jsonb)
  into v_tutorials
  from (
    select
      t.*,
      case
        when v_query='' then 1
        when lower(t.title)=v_query then 100
        when lower(t.title) like '%' || v_query || '%' then 70
        when lower(coalesce(t.subtitle,'')) like '%' || v_query || '%' then 55
        when lower(t.summary) like '%' || v_query || '%' then 40
        when lower(t.category) like '%' || v_query || '%' then 25
        else 0
      end as score
    from public.academy_tutorials t
    where t.active=true
      and t.access_type='public'
      and (
        v_query=''
        or lower(t.title) like '%' || v_query || '%'
        or lower(coalesce(t.subtitle,'')) like '%' || v_query || '%'
        or lower(t.summary) like '%' || v_query || '%'
        or lower(t.category) like '%' || v_query || '%'
      )
    order by score desc,t.featured desc,t.sort_order,t.title
    limit v_limit
  ) x;

  return jsonb_build_object(
    'query',v_query,
    'faqs',coalesce(v_faqs,'[]'::jsonb),
    'tutorials',coalesce(v_tutorials,'[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_help_content(text,integer) from public;
grant execute on function public.get_help_content(text,integer) to anon,authenticated;

insert into public.help_faqs(category,question,answer,keywords,featured,active,sort_order)
values
  (
    'Conta',
    'Preciso estar logado para comprar?',
    'Você pode navegar pela loja sem login. Para recursos vinculados à sua conta, como biblioteca, cupons pessoais, Rewards, Rank e tutoriais protegidos, entre na sua conta CRAZZY.',
    array['login','conta','entrar','cadastro'],
    true,true,0
  ),
  (
    'Pedidos',
    'Onde acompanho minhas compras e entregas?',
    'Depois de entrar, use o painel do cliente e a biblioteca para acompanhar seus produtos, acessos e conteúdos liberados.',
    array['pedido','compra','entrega','biblioteca','painel'],
    true,true,1
  ),
  (
    'Cupons',
    'Onde encontro os cupons que ganhei?',
    'Os cupons vinculados à sua conta ficam em Meus Cupons. Você também pode selecionar um cupom disponível diretamente no carrinho antes do checkout.',
    array['cupom','cupons','desconto','roleta','raspadinha','drop'],
    true,true,2
  ),
  (
    'CRAZZY CLUB',
    'Como funciona o CRAZZY LUCK?',
    'Roleta, Raspadinha e Drop usam resultado definido e registrado no servidor. As chances ativas são exibidas na própria página do CRAZZY LUCK.',
    array['luck','roleta','raspadinha','drop','premio','chance'],
    false,true,3
  ),
  (
    'CRAZZY CLUB',
    'Como funciona o CRAZZY RANK?',
    'Seu Rank é calculado com atividade verificável da sua conta, como compras confirmadas, produtos ativos, avaliações verificadas, Rewards, Luck e participação na comunidade.',
    array['rank','xp','nivel','ranking','leaderboard'],
    false,true,4
  ),
  (
    'Academy',
    'Por que um tutorial aparece bloqueado?',
    'Alguns tutoriais são exclusivos de produtos. Eles são liberados automaticamente quando sua conta possui o acesso ativo exigido pelo tutorial.',
    array['tutorial','academy','bloqueado','produto','acesso'],
    true,true,5
  ),
  (
    'Suporte',
    'Como peço ajuda para o suporte?',
    'Abra um ticket pelo site, descreva o problema e envie as informações necessárias. O acompanhamento fica no próprio ticket.',
    array['suporte','ticket','ajuda','problema'],
    true,true,6
  ),
  (
    'Status',
    'Como sei se algum serviço está em manutenção?',
    'A página CRAZZY STATUS mostra disponibilidade, manutenções e incidentes com nomes amigáveis ao cliente.',
    array['status','manutencao','offline','indisponivel','instabilidade'],
    false,true,7
  ),
  (
    'Feedbacks',
    'Quem pode publicar avaliação verificada?',
    'O selo de compra verificada é concedido quando a conta possui um acesso real ao produto avaliado. A validação é feita no servidor.',
    array['review','avaliacao','feedback','verificada','compra'],
    false,true,8
  ),
  (
    'Segurança',
    'O site mostra dados internos de fornecedores ou integrações?',
    'Não. As telas do cliente exibem apenas as informações necessárias para usar e comprar os recursos da CRAZZY PROJECT.',
    array['seguranca','fornecedor','integracao','dados internos'],
    false,true,9
  )
on conflict do nothing;
