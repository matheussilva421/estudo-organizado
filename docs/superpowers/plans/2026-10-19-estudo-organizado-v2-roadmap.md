# Estudo Organizado V2 — Roteiro de specs e planos por fatias

> **Registro histórico da decomposição aprovada em 2026-10-19.** O roadmap detalhado e vivo da V2 está em [docs/superpowers/v2/ROADMAP.md](../v2/ROADMAP.md), na branch `v2`. Não atualizar dois roadmaps em paralelo; preservar este arquivo como histórico de decisões.

**Data:** 2026-10-19  
**Status:** ROTEIRO DE DECOMPOSIÇÃO, NÃO É PLANO EXECUTÁVEL DE F1–F8  
**Spec-mestra aprovada (G1):** ../specs/2026-10-19-estudo-organizado-v2-design.md  
**Plano F0 aprovado (G2, 2026-10-19):** 2026-10-19-estudo-organizado-v2-f0-audit.md  
**Emenda obrigatória:** A-01 — Impeccable (https://impeccable.style/)

## Por que não existe um único plano de implementação para toda a V2?

As 27 decisões arquiteturais aprovadas definiram invariantes globais, mas a auditoria da V1 (F0) ainda precisa levantar contratos, relações, variantes de banco, lacunas, riscos, dados, telas e cobertura real. Um plano detalhado de F1–F8 redigido hoje inventaria interfaces, arquivos e testes sem evidência suficiente. A solução Superpowers é **spec-mestra aprovada + plano detalhado F0 + specs/planos de implementação por fatia vertical**. Cada nova spec e plano precisa ser revisado antes da execução correspondente.

## Sequenciamento e gates

| Fase | Resultado | Dependência para detalhamento | Gate de execução |
| --- | --- | --- | --- |
| F0 | Inventário V1, baseline de dados/testes/UX, matriz de riscos e proposta de F1 | Spec-mestra aprovada G1 | Plano F0 aprovado G2 + autorização G3/F0 |
| F1 | Fundação mínima V2, domínios/ports, IndexedDB inicial, QA, tokens básicos | Evidências e aceite F0 | Spec F1 aprovada + plano F1 aprovado + autorização específica |
| F2 | Conteúdo/editais, relações canônicas, importação segura | Contratos F1 + mapeamento de entidades | Spec/plano F2 aprovados |
| F3 | Planejamento, ciclo, calendário, metas, reta final e semântica temporal | Conteúdo canônico F2 | Spec/plano F3 aprovados |
| F4 | Execução/sessões, cronômetro determinístico, histórico e questões | Planejamento e persistência seguros | Spec/plano F4 aprovados |
| F5 | Revisões, pontos fracos e inteligência | Sessões e modelos canônicos estáveis | Spec/plano F5 aprovados |
| F6 | Dashboards, navegação integrada, responsividade e design system refinado | Projeções por domínio e dados confiáveis | Spec/plano F6 + aceite Impeccable |
| F7 | Homologação integrada: sync, migração, backup, recuperação, segurança, PWA, cotas gratuitas, piloto | Implementações incrementais anteriores | Gates de segurança e aceite de sistema |
| F8 | Cutover humano e monitoramento V2 | F7 aceita, backups/contingência testados | G5 exclusivamente humano |

**Regra transversal:** os contratos de segurança, migração, sincronização e recuperação precisam nascer e ser testados desde F1; F7 é sua homologação integrada, não o começo da implementação.

## Template obrigatório para cada spec de domínio

Cada spec futura define: objetivo/jornada e cenário de uso; escopo funcional com mapeamento de funcionalidades V1 e decisão de destino aprovada; entidades e invariantes; comandos/consultas/portas com assinatura e contrato; persistência e transações; política offline/sync/conflitos; identidade/segurança; estados de erro/recuperação; UX/responsividade/acessibilidade; riscos e critérios observáveis; casos de teste unitário/contrato/integração/E2E/adversariais; fronteiras de importação; evidências de Impeccable se houver UI; métricas de desempenho e limite de cota gratuito; dependências entre fases e gate humano.

Não criar spec genérica: usar evidência do inventário F0 e indicar fontes e diferenças V1/V2.

## Template obrigatório de writing-plans por domínio

Cada plano tem o cabeçalho obrigatório da skill Superpowers writing-plans, Global Constraints, Review Focus (5 casos e respectivos testes), mapa de arquivos, tarefas pequenas com Interfaces e passos TDD RED→GREEN, verificação independente, commits frequentes, orçamento anti-loop, status de gates, evidências e parada na revisão humana. Não permitir efeitos em V1 sem nova decisão explícita.

### Impeccable — controles obrigatórios em todas as fatias de interface

- Antes de desenhar: inspecionar PRODUCT.md, DESIGN.md, oito temas e a configuração .impeccable existente; checar versão/licença/harness/hook e custo zero.
- Antes de implementar mudanças visuais materiais: shape/critique e proposta de interface, validada pelo gate humano correspondente.
- Após interface funcional: critique, audit, adapt, harden e polish/distill conforme necessidade, com capturas de desktop/tablet/mobile em dados sintéticos e estados vazios/erro/carregando.
- QA: evidência de contraste WCAG AA em todos os oito temas, navegação por teclado, toque, preferências de movimento, regressões visuais e problemas classificados por severidade. A ferramenta não substitui Playwright, testes automáticos de acessibilidade ou revisão humana.
- Se skill/hook inviável ou não autorizada: registrar BLOCKED e não declarar gate visual aprovado. Não sobrescrever automaticamente arquivos de design da V1.
- Planos sem UI não precisam executar crítica visual, mas devem registrar o motivo da não aplicabilidade.

## Regras de stop e rastreabilidade

- **Não autorizado nesta conversa:** implementar tarefas, alterar base V1, acessar dados reais ou ativar billing. O GOAL F0 somente é executável mediante submissão explícita pelo usuário ao Codex. Merges de implementação continuam dependentes de aceite humano; merges documentais G1/G2 foram autorizados.
- Evidências PASS/FAIL/BLOCKED/INCONCLUSIVE/NOT_RUN são guardadas por tarefa; NOT_RUN nunca equivale a PASS.
- Decisões D01–D27 e A-01 são a baseline; mudança exige ADR explícita e aprovação.
- Não declarar versão de banco, compatibilidade, throughput ou métricas de UX não medidas.
- G1 e G2/F0 aprovados pelo usuário em 2026-10-19, método Subagent-driven. O envio explícito do GOAL F0 ao Codex autoriza somente G3/F0; G4/G5 e F1–F8 continuam bloqueados.

## Handoff imediato

Plano F0 revisado e aprovado no G2, com método Subagent-driven. Para iniciar G3/F0, o usuário deverá enviar explicitamente o GOAL em `docs/superpowers/goals/2026-10-19-estudo-organizado-v2-f0-codex.md` no Codex; nenhum trabalho começou nesta conversa. Especificações e planos F1–F8 serão detalhados somente depois de conhecidos e homologados os resultados pertinentes da F0.
