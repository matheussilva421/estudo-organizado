# Sumário da remediação UX-H

**Candidato de código:** `454f27e5207a1ab46e926fe7c8849010f6e4b6a2` (branch `v2`).
**Candidato reprovado:** `a4b56e5e` (HEAD documental `48548168`).
**Status:** `LOCAL_UXH_REMEDIATION_READY_FOR_HUMAN_REVIEW` / `UX_H_RE_REVIEW_PENDING` / `REMOTE_PUSH_NOT_AUTHORIZED`. O Codex não aprova UX-H.

## O que mudou em relação ao reprovado

| Área | Antes (a4b56e5e) | Agora (454f27e5) |
|---|---|---|
| Contraste dos atalhos de Conteúdo | azul padrão `rgb(0,0,238)`, ~1,46:1 estimado | pílulas temáticas, 36/36 amostras ≥ 4,5:1; mínimo 7,02:1 |
| Studios | coluna única e painéis genéricos | Knowledge, Revisões e Análises em duas colunas independentes, com a tarefa principal na primeira dobra |
| Revisões | configuração antes da fila | fila de compromissos e sugestões primeiro; política/ajustes depois |
| Análises | oito cartões uniformes na primeira dobra | escopo em linha, KPI principal dominante, editor e comparação lado a lado; tabela inferior ocupa a largura |
| Capacidade (UX-16) | `max(0)` escondia déficit | excesso explícito e percentual acima de 100% (ex.: 400% · excesso de 90 min) |
| Histórico (UX-17) | sempre comparava os dois mais recentes | compara o checkpoint escolhido com a revisão atual e exige confirmação |
| Encerramento da Reta Final | prévia sem foco, `role=status` com botões | grupo rotulado, heading focável, foco devolvido ao gatilho |
| Hábitos (UX-19) | hábito atual atribuído a sessão antiga | vínculo histórico marcado como não demonstrado |
| Evidências (UX-21) | UUID cru sem contexto | sessão carregada por ID com data, estado e medições; F5 identificado como auditoria |
| Home | CTA secundário fora do herói e links sobre o texto | herói e cards com geometria de referência; CTAs dentro do cartão |
| Mobile | seletor de tema só com glifo | nome do tema visível; barra inferior com cinco destinos preservada |

## Reaproveitamento

Nenhum contrato de F2–F7 foi reimplementado. O diff não altera `application/`, `domain/`, `platform/`, IndexedDB, outbox, sync/ACK, backup, recovery, senha ou relógio. As mudanças são de apresentação e de testes; a única integração nova de rota usa `routeHref` existente.

