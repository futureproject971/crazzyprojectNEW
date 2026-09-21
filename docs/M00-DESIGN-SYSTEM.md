# M00 — CRAZZY DESIGN SYSTEM

## Grupo
GRUPO 00 — CORE DA PLATAFORMA

## Status
**CONCLUÍDO EM FRONT-END / QA TÉCNICO**

Branch: `m00-design-system`

## Objetivo
Concentrar a identidade visual global e os componentes-base da CRAZZY PROJECT sem implementar funcionalidades específicas de Home, Catálogo, Carrinho, Ticket, Rewards, Auth ou Admin.

## Fonte de verdade visual
- logo oficial CRAZZY PROJECT;
- `CRAZZY_PROJECT_NEON_ICONS_V2` como pack neon principal;
- `CRAZZY_PROJECT_ICON_PACK` como fallback;
- tema dark / underground / premium / Tokyo night / cyber-urban;
- azul/ciano como acentos principais;
- magenta apenas como detalhe;
- verde para sucesso/online;
- dourado para premium.

## Estrutura criada
- `src/core/design-system/styles/tokens.css`
- `src/core/design-system/styles/primitives.css`
- `src/core/design-system/components/*`
- `src/core/design-system/icons/registry.ts`
- `src/core/design-system/utils/cn.ts`
- `src/core/design-system/__fixtures__/M00SmokeFixture.tsx`
- `src/core/design-system/index.ts`

## Tokens
- cores
- gradientes
- tipografia
- espaçamentos
- border radius
- sombras
- glow
- motion
- z-index
- container e responsividade base

## Tipografia
- Inter para texto base
- Poppins para UI
- Orbitron para títulos/display
- logo oficial mantém a identidade brush da marca sem reconstrução textual

## Componentes-base
- Button
- IconButton
- Input
- SearchInput
- Select
- Checkbox
- Badge
- Panel / Card
- Tooltip
- Tabs
- Dropdown
- Dialog
- Drawer
- ConfirmDialog
- Skeleton
- Spinner / LoadingState
- EmptyState
- ErrorState
- Toast
- Avatar
- SectionTitle
- PageHeader
- ProgressBar
- Pagination
- NeonIcon
- LineIcon

## Acessibilidade / UX
- focus-visible consistente
- tabs com teclado
- dialog/drawer com Escape
- focus trap em overlays
- bloqueio de scroll do body em overlays
- prefers-reduced-motion
- roles/aria básicos para estados, toast, progresso e overlays

## Compatibilidade
O protótipo provisório da Home foi preservado. Tokens novos foram conectados por aliases aos estilos existentes para iniciar migração sem quebra destrutiva.

## Testes realizados
- TypeScript: **PASS**
- `npm run typecheck`: **PASS**
- Next.js build: **PASS**
- GitHub Actions CI: **PASS**
- smoke fixture de componentes: compilação incluída no typecheck/build

## Pendências futuras
Não bloqueiam M00:
- cursor custom oficial será aplicado quando o asset definitivo existir;
- migração visual completa dos componentes provisórios da Home para os componentes CORE acontecerá no módulo proprietário M02, sem redesenhar M00;
- validação visual pixel-level continua dentro de cada módulo de página.

## Regra após conclusão
M00 passa a ser tratado como módulo protegido. Módulos posteriores podem consumir seus tokens/componentes e fazer apenas correções mínimas necessárias, sem redesenhar o CORE sem motivo técnico real.
