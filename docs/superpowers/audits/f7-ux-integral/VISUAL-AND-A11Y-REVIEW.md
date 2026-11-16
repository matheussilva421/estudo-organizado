# Revisão visual e de acessibilidade

## Referências

Quatro PNGs originais 1586×992 do kit, com hashes em `references/`: neon-teal C191…, esmeralda-dourado F6B7…, azul-ambar 7615…, azul-glacial 785F….

## Evidência

- `screenshots/after/modules/` (quatro viewports) e `modules-full/` (1440, página inteira).
- `screenshots/after/premium/` (Home em temas/viewports) e `states/` (inspetor, prioridade→evidência, prévias, PERFORMANCE, capacidade, reta final, hábitos).
- `comparisons/` (quatro temas, lado a lado e viewports) e `overlays/` a 50%.
- `screenshots/after/contrast/` com 12 temas e JSON de medições.

Todos os caminhos acima são relativos à raiz do ZIP (`screenshots/`, `comparisons/`, `overlays/` e `references/`).

## Acessibilidade

- Teclado, foco, Escape e retorno cobertos nos testes de Command Center, sheet da fila, inspetor, Reta Final e prioridade.
- 12 temas com contraste medido nos links do guia; a medição não certifica toda a interface.
- NVDA/Narrator, toque físico, hardware modesto e zoom nativo manual: NOT_RUN_ENVIRONMENT.

## Diferenças residuais

- Ilustrações secundárias lineares; herói usa a arte original.
- Sem mock 1:1 para Studios; avaliação por gramática, hierarquia e uso real.
- CTA secundário da Home exige rolagem em 320×568; principal permanece visível.
- Páginas longas em editais grandes são paginadas, não virtualizadas.
