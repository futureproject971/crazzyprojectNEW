# CRAZZY PROJECT — Module Status

## M00
**GRUPO 00 — CORE DA PLATAFORMA**  
**M00 — CRAZZY DESIGN SYSTEM**  
Status: **APROVADO E INTEGRADO**

Merged into `phase-1-home`:
`0531d09b81b5a3f5324871bb30224cc060c71dae`

QA:
- typecheck: PASS
- build: PASS
- GitHub Actions: PASS

---

## M01
**GRUPO 00 — CORE DA PLATAFORMA**  
**M01 — CRAZZY APP SHELL**  
Status: **CONCLUÍDO / AGUARDANDO APROVAÇÃO DO USUÁRIO**

Branch:
`m01-app-shell`

QA:
- typecheck: PASS
- build: PASS
- GitHub Actions: PASS

Implementado:
- AppShell
- Header/Navbar
- visitor/client/admin modes
- account menus mock
- responsive mobile Drawer
- shell search visual
- global Footer
- social fallback icons
- compatibility wrappers
- Home provisória consumindo AppShell
- compile fixture dos três modos

Não inclui:
- Auth real
- Client Hub
- Admin pages
- Product/Cart/Ticket business logic
- backend/Supabase

**NÃO iniciar M02 automaticamente.**

Próximo módulo previsto, após autorização:
**M02 — CRAZZY HOME**

Prioridade do M02:
- corrigir wallpaper do Hero;
- inserir logo grande oficial separada;
- reconstruir Hero em camadas reais;
- continuar fidelidade pixel-level à referência.
