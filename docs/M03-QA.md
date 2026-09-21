# M03 — Visual / Functional QA Checklist

## Escopo oficial
CRAZZY DISCOVERY é responsável por descoberta e navegação da loja.

Inclui:
- busca global
- categorias
- filtros
- tags
- novidades
- mais vendidos
- destaques
- lançamentos
- pesquisa

Não inclui:
- página completa de produto
- checkout
- carrinho real
- backend
- recomendação algorítmica real

## Rotas
- [x] /novidades
- [x] /categorias
- [x] /destaques

## Descoberta
- [x] busca mock por texto
- [x] filtro por categoria
- [x] filtro por tags/tendências
- [x] Em alta
- [x] Novos
- [x] Mais vendidos
- [x] Lançamentos
- [x] Destaques
- [x] contador de resultados
- [x] empty state
- [x] loading state
- [x] error state

## Visual
- [x] identidade CRAZZY PROJECT
- [x] dark / Tokyo / cyber-urban
- [x] V2 neon icons
- [x] desktop
- [x] tablet
- [x] mobile
- [x] hover
- [x] focus
- [x] reduced motion
- [x] cards responsivos
- [x] imagem real quando asset existe
- [x] fallback visual quando não existe asset dedicado

## Arquitetura
- [x] mock data separado
- [x] módulo isolado em src/modules/discovery
- [x] M00 reutilizado
- [x] M01 reutilizado
- [x] M02 preservado
- [x] navegação atualizada com alteração mínima

## QA técnico
- [ ] TypeScript / typecheck PASS no HEAD final
- [ ] Next.js build PASS no HEAD final
- [ ] GitHub Actions PASS no HEAD final

Somente após os três itens técnicos acima o M03 pode ser fechado.
