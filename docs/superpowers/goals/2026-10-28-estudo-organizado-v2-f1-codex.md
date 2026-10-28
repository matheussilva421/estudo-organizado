# GOAL único — Estudo Organizado V2 / F1 Fundação e primeira fatia vertical

**Preparado:** 2026-10-28  
**Status:** **HANDOFF PREPARADO, NÃO EXECUTADO.** O aceite do writing-plans F1 (G2) não autorizou implementação nesta conversa. **O envio explícito deste GOAL pelo proprietário ao Codex constitui autorização restrita para G3/F1**, sem autorização para outros ambientes/fases.
**Repositório:** `matheussilva421/estudo-organizado`  
**Branch alvo:** `v2` — `main` é V1 em produção.  
**Issue central:** [#108](https://github.com/matheussilva421/estudo-organizado/issues/108)  
**Método:** Superpowers **Subagent-driven**, com subagente executor e revisor independente por tarefa crítica, revisão final holística; se o ambiente não tiver subagentes, interromper e solicitar decisão, não simular revisores.

## Missão e limites da autorização quando enviado

Implementar **somente** as 14 tarefas do [writing-plans F1 aprovado](../plans/2026-10-28-estudo-organizado-v2-f1-foundation.md), conforme a [spec F1](../specs/2026-10-28-estudo-organizado-v2-f1-foundation-design.md), [ADRs F1-01..05](../specs/2026-10-28-v2-f1-architecture-decisions.md), [A-02](../specs/2026-10-28-v2-multidevice-sync-f1-contracts.md), [spec-mestra D01–D27/A-01/A-02](../specs/2026-10-19-estudo-organizado-v2-design.md) e [roadmap V2](../v2/ROADMAP.md). Consulte a [auditoria F0 aceita com ressalvas](../audits/2026-10-19-f0-acceptance.md), [inventário](../audits/2026-10-19-v1-feature-inventory.json), [riscos](../audits/2026-10-19-v1-risk-matrix.json), `AGENTS.md`, `PRODUCT.md` e `DESIGN.md`.

**Entregável:** `apps/v2/` isolado com React/TS/Vite e uma jornada real de **criar, listar, renomear e recuperar disciplinas** em IndexedDB V2, commit atômico + outbox durável, controles de quota/abort, contratos fake de Google Auth/Firestore, política A-02 de sync automático após opt-in, ID de operação idempotente, ACK condicionado, conflitos, Web Locks seguros, backup/tombstones, reconhecimento de legado, PWA e UX inicial com Impeccable nos oito temas; testes locais e relatório de aceite F1 para revisão humana.

**Não entregar:** sistema de editais/planejamento/reta final/cronômetro completo; login Google real; escrita Firestore remota; migração de acervo real; deploy/publish; integração V2→`main`; F2–F8.

## Preflight e gate de segurança — obrigatório ANTES de qualquer escrita

1. Confirmar HEAD de `main`, `origin/main`, `v2`, `origin/v2`; `git status`, alterações não commitadas, `git worktree list`, branches locais/remotas, PRs, stashes, commits exclusivos e arquivos em progresso. **Não pressupor que SHAs do relatório anterior continuam válidos**.
2. Confirmar a aprovação G1/F1 da spec + cinco ADRs e G2/F1 do plano: [issue #108, comentário da aprovação](https://github.com/matheussilva421/estudo-organizado/issues/108#issuecomment-6470870847). Este GOAL não altera os gates G4/F7/G5.
3. Verificar escopo e compatibilidade de ferramentas instaladas, comandos da V1, `AGENTS.md`, identidade visual, configuração `.impeccable/` e triggers de Cloudflare/GitHub. O workspace V2 deve estar separado do checkout onde a V1 é mantida; reutilizar worktree seguro se existir. **Não criar branch adicional nem PR se a `v2` limpa for suficiente**.
4. Confirmar que o servidor dev V2 usará `127.0.0.1:18431`, independente de V1/mock; IndexedDB e service-worker próprios. Nunca abrir perfil real de navegador contendo dados V1 para testes.
5. Se houver alterações não integradas, conflito material, proteção de branch ou risco de deploy, **parar para inventário e decisão humana**, sem reset, force push ou exclusão.

## Execução completa, com autonomia técnica dentro do escopo

1. Carregar as skills Superpowers aplicáveis: `subagent-driven-development`, `test-driven-development`, `requesting-code-review` e `verification-before-completion`; usar `using-git-worktrees` somente se isolation necessária. O documento writing-plans é o contrato operacional; não improvisar outra arquitetura.
2. Percorrer as **14 tarefas sequenciais** com testes **RED→GREEN**, commits pequenos focados e revisão crítica por tarefa. Preparar instalação local **somente dentro de `apps/v2/`** e inspecionar scripts de ciclo de vida antes de instalar. Não alterar root `package.json`, lockfile V1, `src/**`, Firebase/Cloudflare/regras da V1, `.github/workflows/**`, `PRODUCT.md` ou `DESIGN.md`.
3. Implementar a disciplina local mínima com domínio tipado e persistência IndexedDB que confirme **entidade + operação na mesma transação**. Testar duplicação, refresh, quota/abort e isolamento por perfil. Nenhum erro deve apresentar "salvo" falsamente.
4. Para A-02, usar **fakes e fixtures sintéticos**, sem autenticação/Firestore real. Verificar idempotência e CAS, timeout após commit, ACK somente com prova, conflito persistido, duas abas (Web Locks) e fallback que suspende flush quando lock seguro está indisponível. Demonstrar estados `LOCAL_COMMITTED`, `REMOTE_COMMITTED`, `CONVERGED` sem alegar sincronização real.
5. Testar limites conservadores inferiores a 1 MiB por documento, premissas de custo Firestore Spark e leitura/escrita em 1–3 dispositivos. Backup sintético deve preservar tombstones/versionamento sem tokens. Caso legado #107 deve manter dados incompatíveis em reconciliação, jamais sobrescrever.
6. Usar Impeccable conforme A-01 com baseline de oito temas, desktop/tablet/mobile, teclado, toque, contraste AA e toasts não bloqueantes. **Verificar a skill e seus hooks antes de uso**; não sobrescrever documentos visuais legados nem instalar hooks não autorizados.
7. Criar PWA e testes E2E próprios na origem V2 isolada. Tratar os **107 FAIL da V1** por triagem amostral somente leitura; não corrigir a V1 nem declarar causa global sem prova.
8. Realizar verificação completa de lint, typecheck, unit tests, Playwright E2E e build **em `apps/v2/`**, comparando testes com escopo e critérios de aceite da spec. Corrigir falhas materiais na própria estrutura, com até **duas tentativas por causa material**; se persistir, marcar BLOCKED com diagnóstico, não criar novo PR/branch para contornar.
9. Revisão independente final: segurança, transações, perfis/UID, IDB, idempotência, backup, UX, PWA/SW, dependências/custos e regressões. **Quatro riscos HIGH F0 continuam `UNVERIFIED` até prova da mitigação real correspondente**; fakes/simulações não homologam Firebase real.

## Proibições definitivas

- **Não modificar nem implantar V1/`main`**, suas regras Firebase, dados pessoais/credenciais, Cloudflare de produção, Google Drive, service-worker/cache ou domínio existente.
- Não criar GitHub Actions, CI/CD, Cloud Functions, servidores adicionais, serviços pagos ou billing; custo recorrente **R$ 0**.
- Não realizar login/consulta/escrita em Firebase/Cloudflare/Drive reais, mesmo de testes, sem autorização futura específica.
- Não importar acervos reais; usar somente dados sintéticos e mocks. Não habilitar sync remoto real na F1.
- Não apagar branches/worktrees, stashes, dados ou commits com conteúdo exclusivo sem inventário e aprovação. Branches documentais antigas ficam preservadas até saneamento seguro.
- Não iniciar F2, migração V1→V2, F7 nem cutover.

## Integração, higiene e relatório

- Commits validados devem ser integrados **à própria `v2`**, se seguro e permitido pelo preflight/autorização; caso a branch esteja protegida, respeitar regras existentes e relatar a exigência de PR em vez de contorná-las. Não empurrar código para `main`.
- Antes de push para `origin/v2`, revalidar se há disparadores de deploy remoto configurados; não empurrar se houver risco de publicação da V2 em produção. O envio do GOAL autoriza **push para `v2` somente após essas verificações**.
- Atualizar o relatório canônico `docs/superpowers/audits/2026-10-28-v2-f1-acceptance.md`, o roadmap e a issue #108 com status e evidências reais; não multiplicar relatórios.
- Inventariar branches, PRs e worktrees ao final; fechar/limpar apenas estruturas temporárias inequivocamente integradas e cuja limpeza seja segura e autorizada. Preservar mudanças exclusivas.
- Reportar **implementado / testado / integrado à `v2` / publicado** separadamente; HEADs iniciais/finais, commits, testes e resultados PASS/FAIL/BLOCKED/INCONCLUSIVE/NOT_RUN, achados Impeccable, quatro riscos HIGH, 107 FAIL V1 e pendências.
- **Parar no gate humano `F1_READY_FOR_HUMAN_REVIEW` ou `F1_BLOCKED`**. Não se autoaprovar. Só avançar para F2 com novo aceite específico.

**Ação de autorização futura:** o proprietário enviará este GOAL explicitamente ao Codex quando desejar iniciar G3/F1. **A publicação do texto no GitHub é apenas preparação documental e não aciona qualquer execução.**
