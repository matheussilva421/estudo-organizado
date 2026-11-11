# Resultados de teste — 24865ffb

Windows, Node 26.13.0, npm 12.2.2, Chromium local.

| Comando | Resultado |
|---|---|
| npm run typecheck | PASS |
| npm run lint | PASS, 0 avisos |
| npm run build | PASS; CSS 44,81 kB; JS principal 624,57 kB; aviso Vite de chunks >500 kB mantido |
| npm run test:unit | PASS, 880 testes / 129 arquivos |
| PLAYWRIGHT_PORT=18436 npm run test:e2e | PASS, 226 aprovados, 5 pulados, 231 total |

Skips: captura F3-T40, captura F6, captura F7-UX e duas capturas Premium sob variável de ambiente.

Incidentes corrigidos durante a rodada: contagem de diálogo fechado no teste de toque; controle de tema em 40 px no coarse pointer; leitura de color-mix no contraste; 3 px de overflow em 200% na grade de integridade; overflow do strip de sincronização em 200%.

Não executados: Firebase Emulator (Java ausente), NVDA/Narrator, toque físico, Firefox/Safari.
