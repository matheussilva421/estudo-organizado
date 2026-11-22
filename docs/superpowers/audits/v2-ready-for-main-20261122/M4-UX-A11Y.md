# M4 — UX, acessibilidade e F4-T13

## Evidência automatizada

- E2E local: 250 PASS / 11 SKIP / 0 FAIL, incluindo F2–F6, oito áreas, 12 temas, 320/390/768/desktop, teclado, foco, contraste, reduced motion, offline/PWA e backup/restore.
- E2E real staging: 6/6 PASS (shell, SW, reload, offline, 390/768, S13 e redirect same-origin).
- Testes específicos: `f2-a11y`, `f3-a11y`, `f3-a11y-states`, `f4-a11y`, `f4-accessibility`, `f5-accessibility`, `f6-accessibility-states`, `f7-ux-premium-a11y`, `f7-ux-design-system`, `visual-a11y`.
- As capturas F4 de evidência foram preservadas fora do Git; a captura F4 foi excluída da execução para não sobrescrever os três PNGs protegidos.

## Inventário do ambiente

- `adb`: ausente.
- Emulador Android: ausente.
- NVDA: ausente.
- Narrator: presente em `C:\Windows\System32\Narrator.exe`, mas sem captura automatizada confiável de fala nesta sessão.
- Dispositivo touch: não identificado no inventário PnP.
- F4-T13 (suspensão física prolongada): não executado; suspender a máquina de trabalho seria inseguro.

## Limites

- Não houve toque físico, aparelho modesto, NVDA ou teste de suspensão real. S25 permanece PARTIAL_REAL e F4-T13 NOT_RUN_ENVIRONMENT.
- A aprovação visual/UX subjetiva do proprietário não foi presumida. O máximo técnico desta rodada é `UX_TECHNICALLY_QA_VERIFIED`, não aceite UX-H.
- Leitores de tela e hardware físico precisam de uma etapa humana/física separada; isso não impede o candidato técnico de seguir para revisão.

