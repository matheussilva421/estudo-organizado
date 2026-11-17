# UX-H — checklist de avaliação humana

**Atualizado em 17/11/2026.** Use a URL e o commit registrados no pacote de closeout (a porta pode ser 18431, 18433 ou 18610; registre a escolhida). A matriz de decisão vigente é `docs/superpowers/audits/f7-local-closeout-20261117/MATRIZ-UX-DV-VA.md`.

Marque cada fluxo com `PASS_HUMAN`, `FAIL_HUMAN`, `ACCEPTED_WITH_RESERVATION` ou `NOT_RUN` e registre observação, evidência e data. Nenhum `PASS_LOCAL` equivale a aceite humano.

## A. Home, shell e navegação

- [ ] Início, Conteúdo, Planejamento, Sessões, Revisões, Atenção, Análises, Configurações e Busca em desktop/tablet/mobile.
- [ ] Onboarding, Daily, Active, Final Stretch e Performance.
- [ ] Mover widget, desfazer, recarregar e simular falha de escrita do layout.
- [ ] 12 temas, foco visível, redução de movimento e texto em 200% a 320 px.
- [ ] Command Center, histórico do navegador e deep links por IDs.
- [ ] A-01: quatro links inline abaixo de 24 px; aceitar exceção ou pedir ajuste.

## B. Conteúdo

- [ ] Criar/editar disciplina, edital, vínculo, assunto e aula.
- [ ] Inspetor, seleção, foco de retorno e árvore grande.
- [ ] Arquivar conteúdo e confirmar recusa de alocação nova.
- [ ] Confirmar IDs preservados após edição e reload.

## C. Planejamento

- [ ] Disponibilidade com dois turnos, exceção e capacidade zero.
- [ ] Meta semanal e por disciplina.
- [ ] Meses de 28/29/30/31 dias e virada de ano.
- [ ] Semana, Mês, Lista e Dia; blocos sem data/horário.
- [ ] Prévia de redistribuição, ativação, Reta Final e histórico de checkpoints.
- [ ] C-02: simular CAS conflitante de transição e verificar o rascunho preservado.

## D. Sessões

- [ ] Iniciar, pausar, retomar, concluir e Pomodoro.
- [ ] Fechar aba/recuperar e confirmar que tempo incerto não é creditado.
- [ ] Sessão manual, histórico, filtros e inspeção de alocações.
- [ ] Duas abas: autoridade, conflito e retomada.
- [ ] Hábito vigente versus vínculo histórico (E-07).

## E. Revisões

- [ ] Abrir ≠ iniciar ≠ concluir ≠ avaliar; `startedAt` durável.
- [ ] Retomar idempotente e filtro “Em andamento”.
- [ ] Política base com prévia, cancelamento e STALE_POLICY.
- [ ] Encaixe com prévia, sem sobreposição e sem gravar antes de aplicar.
- [ ] Evidência prioridade → ponto fraco → detalhe F5 → sessão F4.
- [ ] Sheet de filtros em 320/390, teclado, Escape e 200%.
- [ ] C-01: duas abas iniciando a mesma revisão; avaliar a mensagem de conflito.

## F. Análises

- [ ] KPIs de foco, planejado, questões e aproveitamento; ausência não vira zero.
- [ ] Gráfico e tabela usam a mesma série.
- [ ] Períodos 7/30 dias e comparação anterior.
- [ ] Explorar recorte por edital e por disciplina.
- [ ] Metodologia, amostra baixa, período vazio e exportação CSV/JSON.
- [ ] Arquivar snapshot, reabrir somente leitura e recarregar.

## G. Configurações, sync e backup

- [ ] Galeria dos 12 temas e persistência após reload.
- [ ] Consentimento de vínculo, estados discretos de sync e ausência de falso “Sincronizado”.
- [ ] Backup local, prévia SAFE, restauração e read-back.
- [ ] Quota, armazenamento, atualização bloqueada por outra aba e recuperação.
- [ ] Nenhuma ação destrutiva sem confirmação; V1 nunca é tocada pela origem V2.

## H. Acessibilidade e ambiente

- [ ] Teclado, ordem de foco, foco após modal/pager, Escape e retorno.
- [ ] Contraste, alvos de toque e texto em 200% nos layouts principais.
- [ ] NVDA/Narrator, toque físico, zoom nativo e hardware modesto; se ausentes, `NOT_RUN_ENVIRONMENT`.
- [ ] Registrar versões de navegador, viewport, tema, commit, fixture e data por captura.

## Decisões abertas

| ID | P2 | Decisão |
|---|---|---|
| A-01 | quatro links inline abaixo de 24 px | aceitar exceção inline ou ajustar |
| C-01 | conflito ao iniciar revisão em duas abas mostra mensagem genérica | melhorar mensagem ou aceitar |
| C-02 | conflito de transição deixa rascunho sem retomada automática | aceitar rascunho preservado ou implementar retomada |

**Resultado final:** não emitir `PASS_HUMAN_UX` sem a inspeção efetiva do proprietário.
