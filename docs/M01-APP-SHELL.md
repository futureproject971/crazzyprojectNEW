# M01 — CRAZZY APP SHELL

## Grupo
GRUPO 00 — CORE DA PLATAFORMA

## Status
**CONCLUÍDO EM FRONT-END / QA TÉCNICO**

Branch:
`m01-app-shell`

## Responsabilidade
Estrutura global de navegação e layout da CRAZZY PROJECT.

## Implementado
- `AppShell`
- `AppHeader`
- `AppFooter`
- configuração central de navegação
- shell mode `visitor`
- shell mode `client`
- shell mode `admin`
- navegação principal desktop
- área de conta visitante
- menu mock de conta cliente
- menu mock de conta admin
- busca visual para client/admin
- navegação mobile
- Drawer mobile
- badge de carrinho
- footer global
- ícones sociais fallback
- wrappers legados para Navbar/Footer
- Home provisória migrada para consumir o AppShell
- fixture de compilação dos três modos

## Preservação
A composição visual provisória da Home foi preservada. O M01 assumiu Header/Navbar/Footer/Layout sem reconstruir o conteúdo do M02.

## Não implementado de propósito
- autenticação real
- Client Hub
- painel Admin
- busca real
- carrinho real
- ticket real
- permissões/roles
- backend
- Supabase

Esses itens pertencem aos módulos proprietários futuros.

## Responsividade
- desktop: navbar completa
- largura intermediária: itens compactos por ícone
- mobile/tablet estreito: header compacto + Drawer
- footer empilha no mobile

## QA
- TypeScript/typecheck: PASS
- Next.js build: PASS
- GitHub Actions: PASS
- modos visitor/client/admin incluídos em fixture de compilação

## Próximo módulo
Após aprovação explícita:
**M02 — CRAZZY HOME**

Primeiras correções obrigatórias no M02:
1. substituir o wallpaper pixelado do Hero por asset HD correto;
2. renderizar a logo grande oficial como camada separada;
3. manter wallpaper + logo + textos + CTAs independentes;
4. continuar comparação pixel-level com a referência.
