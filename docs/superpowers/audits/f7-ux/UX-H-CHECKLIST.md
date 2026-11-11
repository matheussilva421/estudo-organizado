# UX-H — checklist de avaliação humana

Use http://127.0.0.1:18433 (ver UX-H-START.md). Marque cada caso com PASS_HUMAN, FAIL_HUMAN, ACCEPTED_WITH_RESERVATION ou NOT_RUN e registre observação/evidência/data.

## A. Shell e Home (D01–D36)

- [ ] Sidebar/rail/navbar móvel e destinos Início · Plano · Estudar · Revisões · Mais.
- [ ] Em 320 px, a próxima ação aparece antes dos controles de personalização.
- [ ] Widgets, filtros, edição de layout, rotas e rascunho preservado.
- [ ] Oito temas, foco por teclado visível e texto a 200% sem overflow.
- [ ] Links inline pequenos: decidir se os quatro <24 px exigem correção (P2).

## B. Conteúdo (F2)

- [ ] Criar/editar disciplina, edital, vínculo e assunto.
- [ ] Arquivar conteúdo e confirmar que alocações novas são recusadas.
- [ ] Preservar IDs e retorno contextual após editar.

## C. Planejamento (UX-16/17)

- [ ] Editar disponibilidade com dois turnos no mesmo dia; salvar e recarregar.
- [ ] Criar exceção em feriado e conferir capacidade zero naquele dia.
- [ ] Definir meta semanal e meta por disciplina; conferir progresso.
- [ ] Testar mês civil de 28/29/30/31 dias e virada de ano.
- [ ] Ver lista, não alocados, conflitos e capacidade compartilhada.
- [ ] Prévia de distribuição; ativar cenário somente após confirmação.
- [ ] Reta Final: prévia de adiar/suspender/transicionar. Avaliar P-05 (encerramento direto).
- [ ] Trocar de cenário com prévia aberta; confirmar que nada vaza.
- [ ] Avaliar P-01 (diagnóstico de capacidade) e P-06 (comparação de revisões).

## D. Sessões (UX-18/19)

- [ ] Cronômetro, pausa, retomada e Pomodoro.
- [ ] Simular lacuna/fechar aba e conferir que tempo incerto não é creditado.
- [ ] Registrar manual e comparar com verificado/incerto no inspetor.
- [ ] Filtrar histórico por período, origem, estado e assunto; exportar respeitando filtro.
- [ ] Alocação com disciplina arquivada/assunto removido deve ser recusada.
- [ ] Duas abas: autoridade, conflito e retomada.
- [ ] Avaliar mensagem de conflito entre abas e E-07 (hábitos).

## E. Revisões (UX-20/21)

- [ ] Abrir ≠ iniciar ≠ concluir ≠ avaliar; iniciar cria startedAt e permanece pendente.
- [ ] Retomar é idempotente; filtro Em andamento funciona.
- [ ] Política base exige prévia; cancelar/alterar campos invalida; STALE_POLICY em duas abas.
- [ ] Encaixe é prévia, recusa sobreposição e não grava antes de aplicar.
- [ ] Histórico, versões, motivos de importação e links por ID.
- [ ] Avaliar R-04 (amostra por evidência) e R-09 (aceite distribuído).

## F. Integração total

- [ ] Conteúdo → Planejamento → Sessão → Revisão → Home → Análises.
- [ ] Vínculo de sessão não marca bloco como cumprido.
- [ ] KPIs, filtros e snapshots mantêm proveniência e não inventam zero.
- [ ] Nenhuma renderização altera fatos.

## G. Configurações e proteção

- [ ] Perfil, preferências, backup F7 e recovery com dados sintéticos.
- [ ] Exportação e restauração mostram cobertura e conflitos.
- [ ] Avisos de sync remoto não homologado e consentimento.
- [ ] Nenhuma ação perigosa apaga dados sem confirmação.

## H. Acessibilidade e desempenho

- [ ] Teclado, foco após modal/pager e alvos de toque.
- [ ] Texto 200% e contraste nos temas usados.
- [ ] NVDA/Narrator e hardware modesto: marcar NOT_RUN se não executados.

## P2 — decisão humana obrigatória

| ID | Requisito/D | Efeito | Status técnico | Evidência | Decisão HUMANA | Ação autorizada | Condição de aceite |
|---|---|---|---|---|---|---|---|
| P-01 | D44–D46/D49 | diagnóstico de capacidade e metas comparativas resumidos | PARTIAL | UX16-UX21-TRACEABILITY; PlanningAvailabilityPanel | | | |
| P-05 | D48–D49 | encerrar Reta Final ainda é direto, sem prévia | PARTIAL | FinalStretch.tsx; f3-final-stretch-ui | | | |
| P-06 | D49 | comparação lado a lado de revisões/checkpoints resumida | PARTIAL | PlanningHistory; UX16 traceability | | | |
| R-04 | D57 | fatores explicados, mas amostra por evidência não navegável | PARTIAL | ReviewWorkspace prioridade | | | |
| P-09/R-09 | D44–D59 | aceite único distribuído em testes em vez de jornada formal | PARTIAL | f7-ux-integrated-journey; matrizes | | | |
| C-01 | D55–D56 | conflito ao iniciar em duas abas mostra mensagem genérica | P2 | ReviewWorkspace.startReview | | | |
| C-02 | D45–D48 | transição com CAS de blocos conflitante deixa cenário em rascunho sem retomada automática | P2 | confirmTransition | | | |
| A-01 | D28/D71 | quatro links inline da Home abaixo de 24 px | P2 | HOME-320-AUDIT.md | | | |
| E-07 | D54 | consistência de hábitos/metas resumida | PARTIAL | SessionWorkspace hábitos | | | |

## Registro por caso

| Caso | Resultado humano | Observação | Evidência | Data |
|---|---|---|---|---|
| A | | | | |
| B | | | | |
| C | | | | |
| D | | | | |
| E | | | | |
| F | | | | |
| G | | | | |
| H | | | | |

