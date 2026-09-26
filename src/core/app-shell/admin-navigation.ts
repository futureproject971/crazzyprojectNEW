export const ADMIN_GROUPS = [
  { title: "Visão Geral", description: "Saúde da operação e atalhos essenciais.", tools: [
    { label: "Control Center", description: "Alertas, estoque baixo, entregas e incidentes.", href: "/admin", icon: "/icons/home.svg" },
  ]},
  { title: "Produtos", description: "Produto, plano, mídia, estoque e conteúdo no mesmo fluxo.", tools: [
    { label: "Product Manager", description: "Crie e edite produtos, planos, preço, entrega, mídia e estoque.", href: "/admin/produtos", icon: "/icons/shopping-bag.svg" },
    { label: "Categorias", description: "Organize jogos e vitrines.", href: "/admin/categorias", icon: "/icons/neon-v2/gamepad.svg" },
    { label: "Estoque", description: "Audite keys já cadastradas e estados de entrega.", href: "/admin/estoque", icon: "/icons/package.svg" },
    { label: "Tutoriais", description: "Conteúdo liberado por produto e plano.", href: "/admin/academy", icon: "/icons/book.svg" },
  ]},
  { title: "Clientes", description: "Cliente, Discord e atendimento sem IDs técnicos.", tools: [
    { label: "Customer 360", description: "Compras, produtos, Discord, entregas e histórico.", href: "/admin/clientes", icon: "/icons/users.svg" },
    { label: "Suporte", description: "Tickets, prioridades e conversa.", href: "/admin/suporte", icon: "/icons/headset.svg" },
    { label: "Comunidade", description: "Moderação e atividade da comunidade.", href: "/admin/comunidade", icon: "/icons/users.svg" },
    { label: "CRAZZY CALL", description: "Salas e atendimento por chamada.", href: "/admin/calls", icon: "/icons/headset.svg" },
  ]},
  { title: "Vendas", description: "Venda, pagamento, entrega, financeiro e B2B.", tools: [
    { label: "Vendas", description: "Pedidos e histórico comercial.", href: "/admin/vendas", icon: "/icons/shopping-cart.svg" },
    { label: "Combos e descontos", description: "Defina as porcentagens por quantidade de produtos.", href: "/admin/combos", icon: "/icons/star.svg" },
    { label: "Pagamentos", description: "Cobranças e confirmações.", href: "/admin/pagamentos", icon: "/icons/credit-card.svg" },
    { label: "Financeiro", description: "Receita, taxas e divergências.", href: "/admin/finance", icon: "/icons/credit-card.svg" },
    { label: "Entregas", description: "Fulfillment e pós-pagamento.", href: "/admin/fulfillment", icon: "/icons/package.svg" },
    { label: "Revendedores", description: "Regras e acessos B2B.", href: "/admin/revendedores", icon: "/icons/users.svg" },
    { label: "Parceiros", description: "Parceiros e comissões.", href: "/admin/parceiros", icon: "/icons/crown.svg" },
  ]},
  { title: "CRAZZY Club", description: "FREE, bônus, prêmios, roleta, raspadinha e cupons.", tools: [
    { label: "Club Manager", description: "Visão geral do ecossistema de recompensas.", href: "/admin/club", icon: "/icons/crown.svg" },
    { label: "FREE + Rewards", description: "Missões, testes e recompensas.", href: "/admin/rewards", icon: "/icons/diamond.svg" },
    { label: "Luck / Arcade", description: "Roleta, raspadinha, drops e prêmios.", href: "/admin/luck", icon: "/icons/bolt.svg" },
    { label: "Cupons", description: "Descontos por público e produto.", href: "/admin/cupons", icon: "/icons/star.svg" },
    { label: "Bônus", description: "Carteira promocional do cliente.", href: "/admin/bonus", icon: "/icons/crown.svg" },
  ]},
  { title: "Sistema", description: "Configurações técnicas ficam concentradas aqui.", tools: [
    { label: "Discord", description: "Bot, guild e automações.", href: "/admin/discord", icon: "/icons/brand-discord.svg" },
    { label: "Calls e XP", description: "Ative calls, selecione canais e configure XP pelo painel.", href: "/admin/discord#calls-xp", icon: "/icons/headset.svg" },
    { label: "Cargos e sincronização", description: "Cargo Cliente, cargos dos produtos e fila do bot.", href: "/admin/discord-bridge", icon: "/icons/users.svg" },
    { label: "Integrações", description: "APIs, pagamentos e serviços externos.", href: "/admin/integracoes", icon: "/icons/bolt.svg" },
    { label: "Marca & Aparência", description: "Wallpaper, capas, cores e identidade.", href: "/admin/aparencia", icon: "/icons/diamond.svg" },
    { label: "Segurança", description: "Incidentes e auditoria.", href: "/admin/security", icon: "/icons/shield-check.svg" },
    { label: "Notificações", description: "Avisos operacionais.", href: "/admin/notificacoes", icon: "/icons/flame.svg" },
    { label: "Campanhas Discord", description: "Mensagens, preview e disparos.", href: "/admin/campanhas", icon: "/icons/flame.svg" },
  ]},
] as const;
