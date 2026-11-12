# Convergência visual aos mockups — pacote de revisão

**Código:** a4b56e5e (v2 local)
**Estado:** LOCAL_VISUAL_MATCH_READY_FOR_UX_H / UX_HUMAN_PENDING / REMOTE_PUSH_NOT_AUTHORIZED

## Resultado

A Home foi reconstruída como uma composição real React/CSS, não como screenshot. As quatro referências de 1586x992 convergem em rail, busca, saudação, hero, CTAs, passos, Bento, recursos, iluminação e responsividade.

Métricas finais principais:

- rail 0,0,294x992;
- conteúdo em x=335 com 1235 px;
- busca 955,16,443x40;
- hero 335,191,1235x232;
- passos 335,445,1235x30;
- Bento 335,505,1235x182;
- recursos 335,727,1235x127;
- anel de meta 112 px com valor central;
- cartões de recurso com 100 px e ícones de 56 px.

As diferenças geométricas medidas ficam abaixo de 0,3 px. O instrumento com linhas-guia mostra que o hero do mock começa em y=190/191; y=152 pertence ao subtítulo, resolvendo a última divergência da revisão visual.

## O que mudou nesta rodada

- Espaçamento flush do rail e origem do conteúdo.
- Topbar com busca de 443 px e controles compactos.
- Hero reduzido e iluminado com cena fotográfica dos quatro mockups.
- Onboarding em uma linha no viewport de referência, com quebra segura abaixo dele.
- Bento com anel, calendário e gráfico vazio reais; nenhum número fictício.
- Recursos com ícones e títulos de hierarquia correta.
- Rail agrupado, marca em livros, citação e atmosfera própria por tema.
- Header mobile de duas linhas; CTA principal inteiro em 320x568.
- Bento de 1024–1279 px em duas colunas, com ação dentro do cartão.
- Superfícies dos Studios com cabeçalho, estatísticas e guias premium.

## Evidências

- visual-match-v15: quatro temas vazios em desktop/tablet/390/320x568/320x720.
- visual-match-v15/data: quatro temas com fixture acadêmica.
- visual-match-v15/evidencia-modulos: oito módulos x quatro viewports e 12 temas.
- instrumentos: oito comparações, overlays 50/50, diffs e réguas do hero.
- f7-ux-premium-layout.spec.ts: seis regressões de geometria e responsividade.
- Typecheck, lint e build PASS.
- 880/880 unitários PASS em 129 arquivos.
- E2E final: 240 testes, 235 PASS, 5 SKIP, 0 FAIL.

## Limites

- NVDA/Narrator, hardware modesto e toque físico: NOT_RUN_ENVIRONMENT.
- Firebase, Firestore, Auth, Cloudflare, Drive, staging e custos reais: não ativados.
- Studios não têm mockups 1:1; a aderência é de gramática visual e contratos, não pixel a pixel.
- UX-16/17/19/21 e alguns DV/VA mantêm limitações funcionais históricas, separadas da fidelidade visual.
- Chunks Vite acima de 500 KB continuam; as fontes e ilustrações são locais e otimizadas.
- O aceite UX-H é exclusivo do proprietário. Nenhum push, merge, deploy ou F8 foi realizado.
