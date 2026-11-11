# F7-UX — implementação local para revisão

**Atualizado:** 2026-11-10

**Worktree:** `C:\Projetos\estudo-organizado\_v2-candidate`

**Branch:** `v2`

**Baseline:** `3145e95440f0c38178a205f4247b67a180564214`

**Estado:** `F7_UX_LOCAL_IMPLEMENTED_TESTED_FOR_REVIEW`

**Pacote:** [F7-UX](../../superpowers/audits/f7-ux/SUMMARY.md)

## Objetivo e escopo

Executar localmente o GOAL F7-UX sobre a F7 funcional validada, preservando F2–F7, os 73 commits preexistentes e os gates G-EXT/G-STAGING.

## Concluído

- Contratos por evidência, widgets, filtros, fórmulas controladas, Analytics e snapshots.
- Shell responsivo, Home personalizável, Atenção deduplicada e Configurações protegidas.
- Reordenação e movimentação de Conteúdo com CAS e alternativas de teclado.
- Restore protegido: rebaseline bloqueado, detecção de base stale, cópia pré-restore e read-back transacional.
- Testes e evidências consolidados em `docs/superpowers/audits/f7-ux/`.

## Ressalvas preservadas

- G-EXT, G-STAGING, aceite UX-H, NVDA/Narrator, hardware modesto e multi-dispositivo real: `NOT_RUN`.
- Preferências visuais e relatórios históricos são locais deste navegador e não estão no backup F7.
- `main`/V1, Firebase/KV/Cloudflare reais e F8 permanecem intocados.
- Nenhum push, PR, Action ou deploy foi executado.

## Estado Git

- Baseline `v2`: `3145e954`; `origin/v2`: `7a7df0f2`; `main`/`origin/main`: `9046cfa`.
- 73 commits F7 preexistentes preservados; commits F7-UX permanecem locais.
- Bundle verificado: `_resgate-estudo-organizado/f7-ux-preflight-20261110.bundle`.
- Hashes, branches, worktrees e commits finais: `docs/superpowers/audits/f7-ux/GIT-STATE.md`.

## Testes e evidências

Resultados finais, logs, screenshots, hashes, riscos e matriz estão no pacote F7-UX. O último conjunto inclui typecheck, lint, unit, build, E2E e Firebase Emulator; os números exatos constam em `TEST-RESULTS.md`.

## Próxima ação

Revisar o pacote F7-UX e decidir aceite humano. Não houve integração remota; G-EXT/G-STAGING e F8 continuam bloqueados.

## Retomada — rodada corretiva Premium (2026-11-11)

O GOAL atual é o fechamento local do delta Premium, com o adendo dos quatro conceitos originais. A auditoria histórica permanece em `docs/superpowers/audits/f7-ux-premium/`. A `v2` chegou ao commit de código `da89be4b`, 110 commits à frente de `origin/v2@02b950cd`, sem push; `main@9046cfa2` permanece separada. O bundle de entrada `39097566` foi verificado; cópia em outro disco físico ainda não confirmada.

- `3f79e682`: aviso após transferência real de autoridade em outra aba; cinco testes Foco/F4 passaram. VA-19 segue parcial (conflito de sincronização e compactação a validar).
- `80666921`: prévia e aceite da sugestão de ordem; três testes Home passaram. Desempenho, ajuste de hierarquia/avisos e alvos de toque ainda requerem validação.
- `c6371ce4` e `5e756b26`: teste de aparência preserva cronômetro rodando, sessão pausada e rascunho; dois testes Chromium passaram.
- `8bad5556`: referências e 16 capturas intermediárias indexadas em `ORIGINAL-VISUAL-REFERENCES.md`; contraste amostral nos 12 temas passou.
- `1053daee`: filtros da fila em painel inferior em 320/390 px; seis testes com regressões da fila passaram.
- `bcdf39ba`: biblioteca de editais aponta para a árvore existente pelo ID; três testes com proteção de rascunho passaram.
- `da89be4b`: visão geral de Análises antes do editor e acesso direto com foco; três testes de Atenção/Análises passaram. Drill-down por recorte com dados, valores reconciliados e verificação visual ainda pendentes.

Próxima ação: aprofundar o recorte em Análises e a composição da execução/histórico de Revisões com fixtures; depois fechar testes de grande hierarquia, alerta crítico, Home, capturas finais, revisão independente e ZIP. Rodar Playwright com `PLAYWRIGHT_PORT=18436` e o caminho local de browsers já instalado. Manter UX-H, G-EXT, G-STAGING e F8 separados.
