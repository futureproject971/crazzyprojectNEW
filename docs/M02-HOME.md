# M02 — CRAZZY HOME

## Grupo
GRUPO 01 — EXPERIÊNCIA PÚBLICA

## Rota
`/`

## Responsabilidade
Página inicial pública da CRAZZY PROJECT seguindo a referência visual aprovada.

## Escopo
- Hero principal
- logo central
- wallpaper
- CTAs
- pilares do Hero
- barra de confiança
- preview Feedbacks
- preview Chat Geral
- preview Ticket
- bloco de benefícios
- Produtos em Destaque
- coverflow
- Explore Nossa Loja
- categorias principais

## Regras
- fidelidade visual acima de reinvenção;
- usar M00 para tokens/componentes;
- usar M01 para AppShell;
- MOCK DATA somente;
- sem backend;
- sem auth real;
- sem ticket real;
- sem carrinho real.

## Correções realizadas
- wallpaper anterior de ~5 KB deixou de ser usado no Hero;
- novo wallpaper HD Tokyo foi adicionado em `public/backgrounds/hero-tokyo.webp`;
- Hero foi reconstruído em camadas reais;
- logo agora é elemento de imagem real no JSX;
- tagline é texto real;
- pilares são componentes reais;
- CTAs são links reais;
- carrossel começou a usar os crops reais disponíveis no repositório.

## Observação de asset
A logo grande oficial em alta resolução continua sendo o asset preferido para substituição final. Enquanto ela não estiver versionada no repo, o Hero utiliza a logo oficial já disponível em `public/brand/crazzy-logo-navbar.png` como camada separada, sem depender da imagem de fundo.

## Status
EM IMPLEMENTAÇÃO / QA VISUAL.
