# Aceite — Redesign Premium F7-UX

Base funcional: 25b8ca0f. Esta matriz complementa D01–D71 e AC-01–AC-24; não renumera decisões.

## DV-01–DV-18

| DV | Status | Evidência |
|---|---|---|
| DV-01 | PASS_VERIFIED | 12 temas em THEMES e tokens.css; unit 12 únicos; screenshots |
| DV-02 | PASS_VERIFIED | galeria em Settings; E2E seleção/persistência |
| DV-03 | PASS_VERIFIED | glow/motion/densidade/cards com data attributes e reset |
| DV-04 | PARTIAL | hero contextual vazio/ativo/reta/desempenho; sem auto-rearranjo de widgets |
| DV-05 | PARTIAL | layout escolhido é fixo; não há sugestão automática de rearranjo |
| DV-06 | PARTIAL | Home Bento + estúdios marcados; recomposição profunda de alguns módulos pendente |
| DV-07 | PASS_VERIFIED | onboarding progressivo com 3 passos e dispensa |
| DV-08 | PARTIAL | progressive disclosure existente preservado; três camadas universais não recompostas |
| DV-09 | PASS_VERIFIED | Layered Premium seletivo via tokens/classes |
| DV-10 | PASS_VERIFIED | Modo Foco usa a mesma sessão; E2E pausa/retomada/conclusão |
| DV-11 | PASS_VERIFIED | Semana/Mês/Lista + Dia; preferência persistente |
| DV-12 | PARTIAL | fila/execução/histórico existentes; recomposição visual do estúdio parcial |
| DV-13 | PARTIAL | Análises existentes com drill-down; nova composição visual ampla pendente |
| DV-14 | PARTIAL | árvore/inspetor existentes; biblioteca visual de cards pendente |
| DV-15 | PASS_VERIFIED | Command Center + D33 + Atenção deduplicada existentes |
| DV-16 | PASS_VERIFIED | Settings por categorias + galeria 12 |
| DV-17 | PARTIAL | responsividade/detalhes existentes; novo sistema de bottom sheets ausente |
| DV-18 | PARTIAL | motion/feedback semântico existentes; microinterações amplas não recompostas |

## VA-01–VA-20

| VA | Status | Evidência |
|---|---|---|
| VA-01 | PASS_VERIFIED | 8 temas preservados; suíte completa |
| VA-02 | PASS_VERIFIED | 4 temas novos selecionáveis e distintos; screenshots |
| VA-03 | PARTIAL | troca persiste sem reload; sessão ativa não foi tema-testada |
| VA-04 | PASS_VERIFIED | glow/motion/densidade/cards; reduced motion |
| VA-05 | PASS_VERIFIED | f7-ux-premium-home: Home vazia sem zeros |
| VA-06 | PARTIAL | vazio e Reta Final testados; diário/desempenho parcialmente |
| VA-07 | PARTIAL | layout fixo e hero não reorganizam; aceite de rearranjo não exercitado |
| VA-08 | PARTIAL | módulos mantêm composição distinta; estúdios premium parciais |
| VA-09 | PARTIAL | funções avançadas acessíveis por details/rotas existentes |
| VA-10 | PASS_VERIFIED | f7-ux-premium-focus: sessão única e mesmo relógio |
| VA-11 | PASS_VERIFIED | Semana/Mês/Lista + Dia e preferência |
| VA-12 | PARTIAL | estados reais preservados; recomposição visual parcial |
| VA-13 | PARTIAL | mesmo dataset/tabela existentes; nova visão geral parcial |
| VA-14 | PARTIAL | árvore/inspetor existentes; biblioteca visual parcial |
| VA-15 | PASS_VERIFIED | Command Center/busca/rotas por ID |
| VA-16 | PASS_VERIFIED | Settings separa aparência e operações protegidas |
| VA-17 | PARTIAL | 320/390/zoom OK; bottom sheets novos não implementados |
| VA-18 | PASS_VERIFIED | estados T-03 preservados; testes completos |
| VA-19 | PARTIAL | alertas críticos no Foco implementados; conflito real não testado |
| VA-20 | PASS_VERIFIED / MANUAL_NOT_RUN | 12 temas ≥4.5, overflow/foco; NVDA/hardware NOT_RUN |

## AC-01–AC-24 (preservados)

| AC | Status | Evidência |
|---|---|---|
| AC-01 | PASS_LOCAL | templates/editor/persistência |
| AC-02 | PASS_LOCAL | temas/contraste/foco |
| AC-03 | PASS_LOCAL | 320/390/tablet/desktop |
| AC-04 | PASS_LOCAL | rotas por ID/perfil |
| AC-05 | PASS_LOCAL | draft guard/foco |
| AC-06 | PASS_LOCAL | árvore/hierarquia F2 |
| AC-07 | PASS_LOCAL | cenários/capacidade F3 |
| AC-08 | PASS_LOCAL | vínculo ≠ cumprimento |
| AC-09 | PASS_LOCAL | tempos separados |
| AC-10 | PASS_LOCAL | fila/execução F5 |
| AC-11 | PASS_LOCAL | política versionada |
| AC-12 | PASS_LOCAL | gráfico/tabela reconciliados |
| AC-13 | PASS_LOCAL | ausência ≠ zero |
| AC-14 | PASS_LOCAL | snapshots imutáveis |
| AC-15 | PASS_LOCAL | local ≠ outbox ≠ ACK |
| AC-16 | PASS_LOCAL | ACK parcial |
| AC-17 | PASS_LOCAL | backup parcial não é recuperável |
| AC-18 | PASS_LOCAL | rebaseline bloqueia |
| AC-19 | PASS_LOCAL | BLOCKED_UPGRADE |
| AC-20 | PASS_LOCAL | desvincular preserva fatos |
| AC-21 | PASS_LOCAL | atenção deduplicada |
| AC-22 | PASS_AUTOMATED / MANUAL_NOT_RUN | a11y automatizada; NVDA NOT_RUN |
| AC-23 | PASS_LOCAL | offline/quota |
| AC-24 | PASS_LOCAL | overview/rotas |

