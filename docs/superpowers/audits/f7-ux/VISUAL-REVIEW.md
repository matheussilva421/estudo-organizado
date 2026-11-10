# Revisão visual — F7-UX integrada

HEAD: 68e83479. Fixtures sintéticas; nenhum dado pessoal.

## Home 320 px

- Antes: C:\Projetos\outputs\f7-ux-aderencia-20261110\evidence\home-before\
- Depois: C:\Projetos\outputs\f7-ux-aderencia-20261110\evidence\home-after-dom\
- Próxima ação subiu de y=982 para y=183; overflow a 200% caiu de 446 px para 320 px; ordem DOM igual à visual.
- Quatro links inline ainda medem menos de 24 px (P2 documentado).

## Módulos e temas

- C:\Projetos\outputs\f7-ux-aderencia-20261110\evidence\integrated\modules: home, content, planning, sessions, reviews, attention, analytics e settings em 320/390/tablet/desktop.
- C:\Projetos\outputs\f7-ux-aderencia-20261110\evidence\integrated\themes: oito temas em três viewports.
- 61 arquivos, incluindo manifest.json.

Telas efetivamente alteradas nesta rodada: planejamento (disponibilidade/metas e mês), sessões (filtros/inspetor), revisões (início, prévia de política e histórico) e Home (ordem/zoom).

Contraste e overflow automatizados continuam em visual-a11y.spec.ts e f7-ux-home-320.spec.ts. NVDA/Narrator e hardware modesto permanecem NOT_RUN.

