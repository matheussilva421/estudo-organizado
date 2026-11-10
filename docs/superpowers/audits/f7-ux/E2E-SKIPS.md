# Skips E2E — F7-UX G4

Total de testes listados: 193 em 96 arquivos (playwright test --list, baseline 0d2ee339). Três skips condicionais, todos de geração de evidência em diretório dedicado; nenhum suprime comportamento local testável.

| Teste | Arquivo:linha | Condição | Categoria | Risco | Como remover |
|---|---|---|---|---|---|
| capture_f3_t40_evidence | apps/v2/tests/e2e/f3-t40-evidence.spec.ts:89 | F3_T40_CAPTURE !== '1' | 2 — dependência de ambiente de captura | Baixo; comportamento F3-T40 coberto por testes de unidade/E2E próprios | Definir F3_T40_CAPTURE=1 e apontar diretório de evidência ao gerar capturas |
| f6 representative visual evidence | apps/v2/tests/e2e/f6-evidence.spec.ts:12 | sem F6_EVIDENCE_DIR | 2 — dependência de diretório de captura | Baixo; shell F6 coberto por f7-ux-shell-navigation e outros | Definir F6_EVIDENCE_DIR em execução dedicada |
| f7 ux sanitized visual evidence | apps/v2/tests/e2e/f7-ux-evidence.spec.ts:16 | sem F7_UX_EVIDENCE_DIR | 2 — dependência de diretório de captura | Baixo; os módulos têm testes funcionais próprios | Definir F7_UX_EVIDENCE_DIR em execução dedicada |

Nenhum skip foi adicionado nesta rodada. O novo teste f7-ux-home-320.spec.ts grava em diretório padrão temporário quando a variável não existe, portanto não cria um quarto skip.

Decisão: manter os três skips como gates de evidência; não aumentar timeout/retry e não simular dispositivo, NVDA/Narrator ou nuvem.

