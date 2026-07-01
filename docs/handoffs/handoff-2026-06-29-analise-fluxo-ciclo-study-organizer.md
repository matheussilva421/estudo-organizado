# Handoff — Auditoria do fluxo Ciclo, Calendário e Study Organizer

**Data:** 2026-06-29

**Branch:** `codex/docs-fluxo-ciclo-organizer`

**Natureza da entrega:** documentação e auditoria; nenhum código de produção alterado

## Objetivo da sessão

Analisar detalhadamente o fluxo entre:

- Ciclo de Estudos;
- Sequência dos Estudos;
- Previsão de Sessões;
- Calendário;
- Study Organizer;
- Cronômetro e registro de sessão;
- persistência e sincronização.

A análise também precisava reconstruir as dez capturas fornecidas pelo usuário,
classificar inconsistências e sugerir correções sem mudar o comportamento atual.

## Entrega principal

Foi criado:

- `docs/reports/2026-06-29-analise-fluxo-ciclo-calendario-study-organizer.md`

O relatório contém:

- modelo de dados de `planejamento`, `sequencia` e `eventos`;
- mapa de responsabilidades e fontes de verdade;
- três diagramas Mermaid;
- geração de pesos, blocos e intercalação round-robin;
- previsão e repetição circular da sequência;
- materialização de eventos no Calendário;
- filtros e indicadores do Study Organizer;
- início, conclusão parcial e conclusão total de sessões;
- sessões automáticas, manuais e livres;
- pulo, reabertura, limpeza, exclusão e replanejamento;
- persistência IndexedDB e merge LWW;
- reconstrução cronológica das dez capturas;
- matriz completa de ações e consequências;
- seis achados classificados por impacto;
- recomendações e cenários de teste para uma correção futura.

## Conclusão técnica central

Existem duas noções diferentes de progresso:

1. `distributeStudiedAcrossSeq()` distribui todo o tempo concluído da disciplina,
   inclusive sessões sem `seqId`, para a barra e a Previsão;
2. `getStudiedMinutesForSeq()` usa somente eventos ligados ao `seqId` para
   conclusão operacional e geração de eventos.

Isso explica o estado mostrado nas capturas:

- Constitucional registra `02:59:56`;
- a barra limita o consumo ao alvo e mostra `2h de 2h`, `100%`;
- a etapa continua com status operacional `pendente`;
- o agendador volta a criar “Estudar Direito Constitucional”.

Administrativo foi transformado em `pulada` ao excluir seu evento automático.
A regeneração removeu Administrativo da fila e compactou Civil e Constitucional
nos slots seguintes.

## Achados

1. **Alto:** regra de vínculo manual opt-in contradita pelo progresso amplo por
   disciplina.
2. **Alto:** Previsão e agendador usam fontes diferentes para calcular o
   restante.
3. **Médio:** o texto sugere rollover automático, mas o contador só avança em
   “Recomeçar Ciclo”.
4. **Médio:** duplicação e edição podem preservar status incompatíveis ou deixar
   vínculos históricos órfãos.
5. **Médio:** “Limpar agendados” remove projeções, mas elas podem ser recriadas.
6. **Baixo:** o Organizer lista hoje até hoje + 7, mas conta pendentes somente de
   hoje.

## Recomendação principal

Usar `seqId` como fonte única para qualquer progresso do planejamento:

- barra da etapa;
- previsão;
- duração do evento gerado;
- conclusão e status.

Sessões não vinculadas continuariam alimentando Histórico, Dashboard, hábitos e
estatísticas gerais. O relatório também descreve a alternativa de fazer todo
estudo da disciplina contar, mas essa opção exige reconciliação automática e
regras adicionais.

## Código consultado

Arquivos centrais:

- `src/js/logic/cycle.js`
- `src/js/views/ciclo-view.js`
- `src/js/views/med-view.js`
- `src/js/views/calendar-view.js`
- `src/js/registro-sessao/session-save.js`
- `src/js/registro-sessao.js`
- `src/js/planejamento-wizard.js`
- `src/js/views.js`
- `src/js/components.js`
- `src/js/store.js`
- `src/js/store/indexeddb.js`
- `src/js/sync/sync-center.js`

Testes usados como evidência documental:

- `tests/unit/logic.test.js`
- `tests/unit/registro-sessao.test.js`
- `tests/unit/views-modules.test.js`
- `tests/unit/calendar-view.test.js`
- `tests/unit/sync-center.test.js`
- `tests/e2e/calendar.spec.js`
- `tests/e2e/ciclo-grade.spec.js`
- `tests/e2e/ciclo-step-flow.spec.js`

## Validação

- Nenhum arquivo de produção ou teste foi modificado.
- Os nomes de funções e campos foram conferidos no código atual.
- A aritmética das capturas foi conferida:
  - `9 × 2h = 18h`;
  - `2 ÷ 18 = 11,11%`, exibido como `11%`;
  - `63 × 2h = 126h`.
- A tentativa de executar os testes focais não iniciou porque o comando local
  `vitest` não está instalado/disponível neste checkout.
- Como a entrega é somente Markdown, não foram instaladas dependências.
- A validação final da sessão inclui estrutura dos documentos,
  `git diff --check`, revisão do diff e confirmação de que somente os dois
  documentos planejados foram alterados.

## Publicação

Os documentos compõem o commit:

```text
docs(fluxo): documenta ciclo e study organizer
```

na branch:

```text
codex/docs-fluxo-ciclo-organizer
```

A branch deve permanecer publicada no remoto para revisão e eventual integração.

## Continuação sugerida

Se outra IA implementar as correções:

1. confirmar com o usuário se o planejamento seguirá vínculo explícito por
   `seqId` ou reconciliação automática por disciplina;
2. começar por teste falhando que reproduza “100% visual + etapa pendente”;
3. unificar o cálculo de restante usado por Sequência, Previsão e agendador;
4. cobrir sessões manuais com e sem opt-in;
5. decidir a política de rollover;
6. normalizar status ao duplicar ou trocar disciplina;
7. revisar texto e semântica de “Limpar agendados”;
8. executar testes focais e depois a suíte proporcional ao risco;
9. criar um novo handoff e publicar a branch correspondente.
