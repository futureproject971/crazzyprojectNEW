# M05 — CRAZZY PRODUCT VIEW — QA Checklist

## Página individual
- [x] rota dinâmica /produto/[slug]
- [x] static params para produtos mockados
- [x] 404 para slug inexistente
- [x] breadcrumb
- [x] galeria
- [x] thumbnails
- [x] zoom
- [x] badges
- [x] status visual
- [x] avaliações
- [x] seleção de plano
- [x] CTA visual de compra
- [x] benefícios
- [x] descrição
- [x] compatibilidade
- [x] requisitos
- [x] FAQ
- [x] relacionados
- [x] loading
- [x] error

## Segurança de escopo
- [x] nenhum preço real inventado
- [x] preço permanece "Consultar"
- [x] CTA não cria pedido
- [x] carrinho real continua reservado ao M07
- [x] checkout real continua reservado ao M08
- [x] nenhum backend/Supabase adicionado

## Responsividade
- [x] desktop
- [x] tablet
- [x] mobile
- [x] zoom responsivo
- [x] planos empilham no mobile
- [x] relacionados adaptam o grid
- [x] reduced motion

## Arquitetura
- [x] dados separados em src/modules/product-view/data.ts
- [x] módulo isolado em src/modules/product-view
- [x] consome M04 sem duplicar catálogo
- [x] M00/M01 reutilizados
- [x] M02/M03/M04 preservados

## QA técnico
- [x] TypeScript / typecheck PASS no HEAD final
- [x] Next.js build PASS no HEAD final
- [x] GitHub Actions PASS no HEAD final
