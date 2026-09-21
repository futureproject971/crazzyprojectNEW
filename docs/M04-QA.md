# M04 — CRAZZY CATALOG — QA Checklist

## Escopo oficial
Rota: `/produtos`

### Catálogo
- [x] grid de produtos
- [x] busca
- [x] filtros
- [x] categoria
- [x] ordenação
- [x] badges
- [x] estoque visual
- [x] produto novo
- [x] mais vendido
- [x] promoção
- [x] paginação visual

### Categorias
- [x] Software Gamer
- [x] Contas
- [x] Produtos Premium
- [x] Streaming
- [x] Ferramentas
- [x] Serviços

### Estados
- [x] loading
- [x] empty
- [x] error
- [x] indisponível
- [x] estoque limitado
- [x] disponível

### Responsividade
- [x] desktop
- [x] tablet
- [x] mobile
- [x] filtros adaptados para tela menor

### Interação
- [x] hover
- [x] focus
- [x] reduced motion
- [x] paginação
- [x] busca
- [x] ordenação
- [x] filtros combináveis
- [x] limpar filtros

### Arquitetura
- [x] mock data separado
- [x] módulo isolado em `src/modules/catalog`
- [x] M00 reutilizado
- [x] M01 reutilizado
- [x] M02 preservado com integração mínima
- [x] M03 preservado
- [x] nenhum Product View M05 foi construído

## QA técnico
- [x] TypeScript / typecheck PASS no HEAD final
- [x] Next.js build PASS no HEAD final
- [x] GitHub Actions PASS no HEAD final
