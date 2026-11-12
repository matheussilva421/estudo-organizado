# Riscos e gates

## Gates

- UX-H: PENDING_HUMAN. O código está em LOCAL_VISUAL_MATCH_READY_FOR_UX_H, sem autoaprovação.
- G-EXT/G-STAGING/F8/push: NOT_AUTHORIZED/NOT_RUN.
- main e V1: intocadas.

## Riscos e limitações reais

- Studios não possuem mockup 1:1; a aderência é de gramática visual, responsividade e contratos.
- UX-16/17/19/21 continuam PARTIAL_LOCAL em detalhes funcionais já documentados.
- DV-04/05/06/08/12/13/14/17/18 e VA correspondentes permanecem parciais ou pendentes de fixture; não são P0 desta fase visual.
- O link de integridade saudável é oculto na Home móvel para preservar a primeira dobra; Atenção, Settings e alertas compensatórios permanecem acessíveis.
- O tema móvel usa indicador visual compacto; o nome do tema é mostrado ao abrir o select e na galeria de Configurações.
- NVDA/Narrator, hardware modesto e toque físico: NOT_RUN_ENVIRONMENT.
- Build tem chunks acima de 500 KB; o aviso foi medido, sem refatoração de bundler não autorizada.
- Backup final está em C: e D:, mesma máquina, sem offsite.
- Firebase, Cloudflare, Drive, staging e custos reais não foram testados.

## Critério para UX-H

O pacote local está pronto para avaliação humana. O proprietário deve comparar os PNGs e decidir sem presumir push, publicação, convergência remota ou F8.
