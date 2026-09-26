# Atualização consolidada — 26/09/2026

Uma publicação final. Não confundir implementação local com funcionamento validado em produção.

- [x] Produto criado sem planos automáticos; sugestões ao adicionar plano.
- [x] Preço/estoque independentes por plano; rascunhos não bloqueiam planos prontos.
- [x] Keys inline, entrega automática, duração, pausa, arrastar ordem e excluir plano preservando histórico.
- [x] Página de produto organizada conforme image(20260926-145614).png.
- [x] Cargo Cliente global + cargo por produto, tutorial e sincronização Discord.
- [x] Combos com catálogo real e percentuais administráveis.
- [x] Drop diário grátis, roleta de cupons 5–50%, 50% extremamente raro.
- [x] Roleta/raspadinha: produto e plano administráveis, key automática e tutorial.
- [x] Roleta: cores únicas, legenda correspondente, destaque sincronizado com desaceleração.
- [x] Tickets: pendência por lado, aviso fora do avatar, resposta limpa pendência do staff.
- [x] Notificações opt-in, som, PC/celular quando suportado; fechamento/reabertura acessíveis.
- [x] Header sem sobreposição, painéis admin/cliente/club organizados, Enter envia chat.
- [x] Fundo cidade azul fornecido, personagens acima, logo transparente centralizada.
- [x] Link compartilhado com “Quem não xita não brilha”.
- [x] CRAZZY CALL sem áudio/microfone, tela + webcam opcional; preservar PiP/chat/live/senha.
- [ ] Validação real do BOT CORE: cumprir voice-requirements.txt (calls, convites, owner, cleanup, handoff, XP, economia única, segurança e recuperação).
- [x] Consultar documentação oficial PurinCash sobre token de provedor/estoque.
- [ ] Validação completa das integrações reais: fluxos reais, TypeScript, build, permissões, migrations e testes.
- [ ] Commit consolidado e uma publicação final; registrar limitações externas concretas.

## Evidência inicial

O catálogo no banco tem todos os planos pausados. Warzone / 1 Dia tem preço 100 e duas keys, mas active=false. Outros planos incompletos devem continuar como rascunhos independentes.
O BOT CORE existente está em apps/discord-bot/src; ainda não registra GuildVoiceStates. CRAZZY CALL usa LiveKit e as tabelas call_rooms/call_participants. Existe carteira bonus_wallets e motor luck; reutilizar.
O prêmio de produto atual cria entitlement mas não consome/entrega key. O motor exige bonus_cost_cents>0, incompatível com drop grátis. Corrigir transacionalmente.

## Fechamento da revisão

Os itens marcados descrevem implementação e verificações registradas em release-review.md; não equivalem a teste real de todos os serviços externos. Calls e XP, cargos, prêmios e descontos são configuráveis no painel. Há pendências de conexão do bot e escolhas comerciais, detalhadas no relatório.
