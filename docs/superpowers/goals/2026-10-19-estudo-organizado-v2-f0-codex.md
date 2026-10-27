# GOAL Codex — Estudo Organizado V2 / Fase F0 (Auditoria V1)

**Data:** 2026-10-19
**Estado:** GOAL preparado para execução futura pelo Codex; nenhum passo executado nesta conversa.
**Método:** Superpowers Subagent-driven, com revisão independente por tarefa.
**Branch alvo para a auditoria:** `v2` (sem PR/branch extra por padrão, desde que seguro; `main` permanece produção V1).
**Roadmap e índice canônico:** `docs/superpowers/v2/ROADMAP.md`.
**Escopo único autorizado quando o usuário enviar este GOAL ao Codex:** F0, sem implementar a V2 nem alterar a aplicação V1.

## Objetivo

Execute **somente a Fase F0** do Estudo Organizado V2: inventário funcional completo da V1, rastreabilidade de fontes e testes, contratos/esquemas de dados, matriz de riscos, baseline de qualidade, auditoria da identidade visual com Impeccable e relatório de aceite humano. Conserve integralmente a V1 e toda a produção, usando somente leitura do legado e ferramentas de auditoria isoladas.

## Documentos mandatórios (ler nesta ordem)

1. `AGENTS.md` e instruções de continuidade e segurança do repositório (sem contornar os gates).
2. `docs/superpowers/specs/2026-10-19-estudo-organizado-v2-design.md` — **G1 aprovado**, 27 decisões + Emenda A-01.
3. `docs/superpowers/plans/2026-10-19-estudo-organizado-v2-f0-audit.md` — **G2 aprovado**, plano F0 com 6 tarefas e passos TDD.
4. `docs/superpowers/plans/2026-10-19-estudo-organizado-v2-roadmap.md` — somente referência; F1–F8 **NÃO** estão autorizadas.
5. `PRODUCT.md`, `DESIGN.md`, `docs/architecture/app-overview.md`, documentação de sync/segurança pertinente e `.impeccable/` — baseline real a preservar.

Verificar primeiro que `v2` contém a spec e o plano aprovados e está baseada no estado correto da V1. PRs documentais #104/#105 foram integrados à `main`; sua existência histórica não justifica abrir novos PRs.

## Invariantes absolutos

- **NÃO implementar React, TypeScript, Vite ou qualquer funcionalidade da V2 nesta F0.** Não modificar `src/`, `PRODUCT.md`, `DESIGN.md`, `AGENTS.md`, `.impeccable/`, `firestore.rules`, configurações de produção, release, cache/versionamento da PWA, banco de dados da V1 ou credenciais.
- **NÃO acessar dados pessoais reais**, IndexedDB de perfil habitual, exportações do usuário, Firebase de produção, tokens, Cloudflare real ou Google Drive. Usar leitura estática de fontes, fixtures sintéticas, Firebase Emulator Suite quando estritamente necessário e mock isolado existente.
- **CUSTO ZERO obrigatório**: nenhum billing, API paga, assinatura, SaaS ou serviço remoto oneroso.
- **Preservar D01–D27 e A-01** sem alteração silenciosa. Alterações materiais → ADR e gate humano.
- **Impeccable obrigatório no QA visual F0:** inspecionar a instalação/configuração já existente antes de executar comandos. Não sobrescrever `PRODUCT.md`, `DESIGN.md` ou `.impeccable/`, nem instalar hooks ou habilitar telemetria sem autorização explícita. Se impossível executá-lo de modo seguro/gratuito, reportar BLOCKED; nunca alegar PASS.
- Manter oito temas e identidade escura precisa (Grafite, Ardósia, Platina, Terminal, Neon, Arrakis, Codex e Plasma; steel-blue; Plus Jakarta Sans + DM Mono); WCAG AA como alvo de avaliação, não resultado presumido.
- Status de evidência obrigatórios: **PASS / FAIL / BLOCKED / INCONCLUSIVE / NOT_RUN**, sem tratar lacunas como sucesso.
- Os únicos novos arquivos de código permitidos são **validadores/ferramentas de auditoria** em `scripts/v2-audit/` e seus testes em `tests/unit/v2-audit-*.test.js`, conforme plano. Artefatos da auditoria ficam em `docs/superpowers/audits/`.
- Commits focados diretamente em `v2` são preferidos se a árvore de trabalho estiver limpa e a execução não interferir em outras tarefas. Worktree/branch temporária somente para isolamento técnico comprovadamente necessário; não abrir PR automaticamente. **Não fazer merge para `main`**, não gerar release nem alterar V1. Encerrar inventariando e saneando referências temporárias com segurança.

## Execução obrigatória

1. **Preflight somente leitura:** confirmar estado real de `main` (V1 produção) e `v2` (desenvolvimento), HEAD, divergências, árvores de trabalho, PRs, outras branches/worktrees, ferramentas e skill Superpowers. Preferir trabalhar em `v2`; preparar worktree/branch somente se o isolamento for indispensável. Se AGENTS.md exigir segundo aceite para retomada, respeitá-lo.
2. **Invocar Superpowers Subagent-driven**. Uma tarefa por subagente, com revisão independente antes da próxima, e revisão holística ao final; nenhuma alteração fora do escopo. Em ausência da capacidade, STOP e solicite decisão humana, sem simular subagentes.
3. **Task 1:** criar, via TDD RED→GREEN, o validador do inventário e seus testes. Rejeitar duplicações, faltas de proveniência e falso aceite humano.
4. **Task 2:** mapear todas as superfícies funcionais, módulos, telas, testes, integrações e lacunas. Confrontar descoberta estática e inventário; justificar exclusões. A proposta de preservar/reformular/unificar/adicionar/descontinuar é **PROPOSTA**, não aprovação.
5. **Task 3:** mapear schemas reais, exportações, variantes e versões documentadas/observadas; registrar discrepâncias, relacionamentos, risco de migração e informações desconhecidas. Não transformar dados.
6. **Task 4:** produzir matriz de riscos de IndexedDB, sync, outbox/tombstones, Firestore Rules, autenticação, XSS, backup, multiaba, quota, Service Worker, privacidade e recuperação. Separar fato observado de hipótese.
7. **Task 5:** executar baseline seguro da V1 conforme disponibilidade (Vitest, lint, contrast/design, Playwright mock); preservar saídas reais e flags de erro. Aplicar Impeccable somente com configuração segura a capturas e dados sintéticos, incluindo desktop/tablet/celular, os oito temas, acessibilidade, estados de erro, foco, responsividade e redução de movimento. Se houver bloqueio de ferramenta/hook, não contorne; marque BLOCKED e solicite aprovação adequada.
8. **Task 6:** consolidar matriz de cobertura, divergências, riscos, baseline, QA Impeccable, critérios de aceite, rastreabilidade D01–D27/A-01 e proposta de F1. Executar os validadores/testes focalizados e revisão independente final.
9. **Fechar com relatório F0 e estado Git limpo**: registrar evidências, status completos, commit SHAs, arquivos alterados, riscos, condições não verificadas e revisão de segurança. Confirmar se os commits ficaram integrados na branch `v2`; não criar PR salvo exigência de revisão/proteção. Parar no **gate humano de F0**. Não executar F1.

## Regras de execução e stop

- Em cada tarefa: RED → implementação mínima do **validador de auditoria**, não do produto → GREEN → revisão independente → commit. Nunca usar testes só para justificar mudanças no legado.
- Se um teste da V1 falhar, registrar diagnóstico e evidência, **sem corrigir a V1**.
- Não iniciar varreduras massivas/monolíticas ou testes reais de produção sem necessidade e autorização. Priorizar caminhos focalizados e limitar consumo de contexto.
- No máximo duas tentativas locais de correção de uma mesma falha material por tarefa. Persistindo falha ou incerteza de dados, STOP, diagnosticar e escalar; não criar loop de patches.
- Não fabricar screenshots, checks, aprovações, testes, merges ou declarações de compatibilidade.
- Se a auditoria encontrar conflito material com a spec, **não modificar as 27 decisões**: redigir proposta de ADR e solicitar aprovação humana.
- Se houver bloqueio de Impeccable, falta de isolamento ou possibilidade de tocar dados reais, classificar BLOCKED e parar somente a etapa afetada, preservando as evidências já seguras.

## Critério de conclusão

Entregar inventário funcional com mapa de fontes, relatório de schemas/migração, riscos priorizados, baseline de testes/UX, evidências Impeccable quando executável e relatório F0 para decisão humana. **Não declare F0 aprovada sem aprovação humana específica.** Dê o link da branch/commits (e PR apenas se necessário), resuma PASS/FAIL/BLOCKED/INCONCLUSIVE/NOT_RUN, liste os pontos que impedem F1 e solicite aceite específico. Todos os gates G4/G5 e o cutover permanecem bloqueados.
