# Revisão consolidada de 26/09/2026

Base: crazzyprojectNEW main d0c85670326b6ca7416d3529568b627343bd0b9f. Uma atualização de main, sem publicações intermediárias do site.

## Operação pelo painel, sem editar código

| Configuração | Onde administrar |
|---|---|
| Ativar calls, canais, sala vazia, quantidade de salas | Admin → Discord → Calls e XP |
| Taxas de XP, limites diário/sessão, conversão para BONUS | Admin → Discord → Calls e XP |
| Bot conectado, compartilhamento disponível, falha de aplicação | Status na mesma tela, atualizado a cada 30 segundos |
| Cargo Cliente global | Admin → Cargos e sincronização |
| Cargo do produto, tutorial, nome, mídia, planos | Admin → Produtos |
| Preço, duração, pausa, keys por plano, ordem, exclusão | Editor do produto → Planos |
| Percentuais dos combos por quantidade | Admin → Combos e descontos |
| Campanhas, ativação, custo, produto/plano do prêmio, pesos | Admin → Luck / Arcade |
| Cupons e campanhas de desconto | Admin → Cupons |

Salvar parâmetros não instala um processo do bot nem cria credenciais de terceiros. O painel mostra essa distinção. Nenhuma configuração comercial acima exige uma alteração futura de código.

## Entregue no código

- Produto sem planos automáticos; presets somente ao adicionar. Estoque automático por plano, keys inline e salvamento dos rascunhos. Arrastar, mover e arquivar planos sem destruir o histórico.
- Catálogo considera planos prontos independentemente de planos vazios. Warzone 1 Dia tinha preço e duas keys, mas estava pausado; corrigido no banco. Página de produto em duas colunas, planos em linhas e compatibilidade sob a mídia quando cadastrada.
- Cargo global Cliente separado do cargo do produto. Entrega/tutorial e fila de sincronização usam o produto, não cargo por variação.
- Combos calculados sobre catálogo real e tabela administrável; mesma regra no checkout.
- Drop gratuito diário, oito descontos de 5% a 50%; peso inicial de 50% = 1/10000. Entrega de prêmio de produto com estoque bloqueado transacionalmente, key privada, entitlement e tutorial. Idempotência e limite diário.
- Roleta com cores únicas e legenda destacada pelo ângulo do ponteiro durante a desaceleração. Prêmios de roleta/raspadinha exigem produto e plano.
- Pendência de staff somente em tickets abertos/aguardando staff; badge nos Tickets. Alertas de resposta, opção de notificação, som após interação, Enter envia e Shift+Enter quebra linha. Ajustes de espaçamento do header.
- Navegação admin por área; wallpaper fornecido como fundo, logo central e personagens existentes acima. Metadados “Quem não xita não brilha”.
- CALL com permissão de publicação restrita a câmera/tela no servidor, sem microfone/áudio da tela; chat, live/espectadores e controles existentes preservados.
- BOT CORE existente ampliado com calls temporárias, privacidade, limite, convite, remoção, transferência, encerramento, recuperação e acesso pessoal ao site. XP registrado por observações do servidor, sem concessão pelo cliente, com teto e conversão na carteira BONUS existente.

## Validação realizada

- TypeScript e build Next de produção passaram; lint de sintaxe/CSS passou; sintaxe do BOT CORE passou.
- Navegador: home, catálogo, produto Warzone e combo abriram sem exceção JavaScript, overlay de erro ou overflow horizontal; home mobile também sem overflow.
- Componente real de configuração de calls testado em navegador com API de fixture isolada: seleção por nome, ativação, edição de XP, payload salvo e feedback de sucesso. Isso não simula conexão real ao Discord.
- SQL transacional com rollback: entrega de key/prêmio/tutorial, repetição idempotente, limite diário e ausência de débito no drop. Grants impedem cliente de cunhar XP ou reservar sala diretamente.
- SQL transacional com rollback: uma sala por dono, bloqueio de sala em provisionamento, handoff de uso único, membro removido sem acesso, cálculo XP, repetição sem pontos duplicados, teto de sessão e encerramento de sessão inativa.
- Seis migrations aplicadas. Checkout purincash-payment atualizado de v16 para v17, preservando entrypoint e política de autenticação existentes.

## Dependências e limites reais

- Não havia heartbeat do BOT CORE na verificação. Seu processo precisa receber esta versão e estar conectado ao Discord/LiveKit para executar calls/roles/XP. Painel e código não equivalem a execução real do bot.
- Categoria/canal das calls, cargos Cliente/produto, taxas/limites de XP e produtos/planos das campanhas ainda dependem das escolhas do administrador. Todos os campos operacionais estão no site. Não atribuir estoque pago a sorteios sem escolha explícita.
- Campanhas antigas de roleta/raspadinha que entregavam cupons foram desativadas no nível dos prêmios. Configure produto/plano e custo para disponibilizá-las. O drop já usa cupons gratuitos.
- Notificações usam a página ativa e APIs de notificação do navegador/SW quando suportadas; recebimento com o site completamente fechado não foi implementado como Web Push.
- Imagens externas de personagens/capas não carregaram em parte do ambiente de teste; as URLs existentes foram preservadas. Wallpaper local conferido visualmente.
- Calls reais com múltiplas contas Discord/LiveKit, pagamentos reais e notificações em dispositivos físicos não foram executados nesta revisão. Não declarar validação ponta a ponta dessas integrações.

## PurinCash: resultado da consulta

Documentação oficial: https://docs.purincash.com/guias/produtos e https://docs.purincash.com/guias/entrega.

GET /v1/store/products expõe produtos, variações e disponibilidade, incluindo fornecedores externos aprovados. Na cobrança, supplier.productId recebe o ID público prod_… e supplier.variationIndex seleciona a variação. Após pagamento, a entrega pode ser obtida pelo endpoint de deliveries ou webhook. Isso permite usar produto de fornecedor no site com aprovação e as regras da API.

Não foi encontrado nessa documentação um endpoint público equivalente ao cadastro inicial do token de provedor feito pelo bot. Não confundir listar catálogo/entregar após pagamento com importar antecipadamente todas as keys. Esta revisão não afirma ter implementado esse cadastro não documentado.
