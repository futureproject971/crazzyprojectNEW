# M03 — CRAZZY DISCOVERY

## Grupo
GRUPO 01 — EXPERIÊNCIA PÚBLICA

## Responsabilidade
Descoberta e navegação pública da loja.

## Rotas
- `/novidades`
- `/categorias`
- `/destaques`

## Implementado
- busca global visual/mock
- categorias
- filtros por categoria
- tags/tendências
- novidades
- mais vendidos
- destaques
- lançamentos
- pesquisa client-side
- contador de resultados
- empty state
- loading state
- error state
- rotas com experiências adaptadas
- CTA da Home conectado a `/categorias`
- navegação global conectada a `/novidades`
- desktop / tablet / mobile
- hover / focus / reduced motion
- MOCK DATA separado em `src/modules/discovery/data.ts`

## Preservação
- M00 reutilizado sem redesenho.
- M01 reutilizado sem redesenho.
- M02 preservado; somente o CTA de categorias recebeu integração mínima com M03.

## Fora do escopo
- página completa de produto
- catálogo comercial completo
- carrinho
- checkout
- busca backend
- Supabase
- recomendação algorítmica real

## QA técnico
- TypeScript / typecheck: PASS
- Next.js build: PASS
- GitHub Actions: PASS

## Status
**CONCLUÍDO TECNICAMENTE / AGUARDANDO APROVAÇÃO DO USUÁRIO**

## Próximo módulo após aprovação
**M04 — CRAZZY CATALOG**

Rota:
`/produtos`
