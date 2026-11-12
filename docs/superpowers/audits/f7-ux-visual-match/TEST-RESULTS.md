# Resultados — pacote visual b670926f

Ambiente: Windows, Node 26, npm 12, Chromium local.

| Comando | Resultado |
|---|---|
| npm run typecheck | PASS |
| npm run lint | PASS, sem saída |
| npm run build | PASS (executado dentro do webServer E2E) |
| npm run test:unit | PASS, 880/880 em 129 arquivos |
| npm run test:e2e | PASS, 229 aprovados, 5 pulados, 0 falhas em 234 |

Testes dirigidos adicionais: Home/Planning/Insights/a11y 17 PASS; timer/Foco/histórico 9 PASS; Shell/mobile/offline 6 PASS.

Skips: capturas F3-T40, F6, F7-UX e duas capturas Premium sob variável. NVDA/Narrator, hardware e toque físico: NOT_RUN_ENVIRONMENT.

Baseline anterior: 226 E2E; atual 229, com testes novos de histórico visual, navegação de estúdio, recorte e tema.
