# Convergência visual aos mockups — pacote de revisão

**Código:** 08700060 (v2 local) · **Estado:** LOCAL_VISUAL_MATCH_IN_PROGRESS / UX_HUMAN_PENDING / REMOTE_PUSH_NOT_AUTHORIZED

## O que mudou

A apresentação foi reconstruída sem alterar domínio ou serviços. Na rodada v13, o desktop passou a seguir a geometria medida dos mockups: rail de 294 px encostado à esquerda, conteúdo em x=335, topbar com 16 px de respiro, busca de 443 px, hero 1235x232 em y=191, passos em uma linha de 30 px, Bento 1235x182 em y=505 e recursos em y=727 com cartões de 95 px.

A Home usa recorte fotográfico real dos quatro mockups, título editorial, dois CTAs reais, Bento 1/1,08/1,25 e recursos com ícone à esquerda. O painel de widgets fica na segunda camada. A topbar mantém Comandos em um controle compacto dentro da busca, além de Atenção, Configurações e avatar.

Os estúdios continuam com subnavegação e visões reais: Review com histórico, Knowledge com biblioteca, Planning com contagens por cenário, Insights com recorte por dimensão, Sessions com estado/histórico/recuperação. Settings mantém a galeria dos 12 temas e categorias.

## Evidências da rodada

- Capturas v13 nos quatro temas em desktop, tablet, 390 e 320 px.
- Comparações lado a lado, sobreposição 50/50 e diferença em visual-match-v13/instrumentos.
- Regressão de geometria em f7-ux-premium-layout.spec.ts, incluindo quebra segura em 1440 px.
- Typecheck, lint e build PASS.
- 880/880 testes unitários PASS em 129 arquivos.
- E2E: 231 PASS, 5 SKIP, 0 FAIL. Os cinco skips são capturas condicionais de F3/F6/F7 sem diretório de evidência explícito.
- 320 px com texto a 200% PASS após reaplicar a regra móvel dos cards de recursos.

## Limites assumidos

- Cartões Bento usam estado vazio real no lugar de percentuais, gráficos e contagens fictícias do mock.
- Profundidade e iluminação são CSS; a fotocomposição original é aproximada.
- Módulos usam a gramática premium e subnavegação, mas continuam em painéis; não há mockups 1:1 para eles.
- A faixa de onboarding fica em uma linha a partir de 1586 px e quebra entre 1024 e 1585 px para evitar overflow.
- Revisão visual independente desta rodada e aceite humano permanecem gates separados.
