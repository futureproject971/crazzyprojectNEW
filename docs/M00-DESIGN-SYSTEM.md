# M00 — CRAZZY DESIGN SYSTEM

## Grupo
GRUPO 00 — CORE DA PLATAFORMA

## Objetivo
Concentrar a identidade visual global e os componentes-base da CRAZZY PROJECT sem implementar funcionalidades específicas de Home, Catálogo, Carrinho, Ticket, Rewards, Auth ou Admin.

## Fonte de verdade visual
- CRAZZY PROJECT logo oficial.
- CRAZZY_PROJECT_NEON_ICONS_V2 como pack neon principal.
- CRAZZY_PROJECT_ICON_PACK como fallback.
- Tema dark / underground / premium / Tokyo night / cyber-urban.

## Estrutura adicionada
- `src/core/design-system/styles/tokens.css`
- `src/core/design-system/styles/primitives.css`
- `src/core/design-system/components/*`
- `src/core/design-system/index.ts`

## Tokens
- cores
- gradientes
- radius
- espaçamento
- tipografia
- sombras
- glow
- motion
- z-index
- container/breakpoints

## Componentes-base
- Button
- IconButton
- Input
- SearchInput
- Select
- Checkbox
- Badge
- Panel
- Tooltip
- Tabs
- Skeleton
- LoadingState
- EmptyState
- ErrorState
- Dialog
- Drawer
- Avatar
- SectionTitle
- Toast

## Regras
- Não usar visual SaaS genérico.
- Neon deve ser hierárquico, não espalhado em tudo.
- Blue/cyan são os acentos principais.
- Magenta é detalhe.
- Green é status positivo.
- Gold é premium.
- Todo controle interativo precisa de hover/focus.
- Respeitar `prefers-reduced-motion`.
- Componentes específicos de módulos não entram no CORE.

## Pendências antes de considerar M00 concluído
- integrar tokens ao CSS legado gradualmente sem quebrar a Home provisória;
- validar todos os componentes em desktop/tablet/mobile;
- revisar modal/drawer/tooltip com teclado;
- confirmar cursor oficial quando o asset existir;
- rodar build e CI após integração final.
