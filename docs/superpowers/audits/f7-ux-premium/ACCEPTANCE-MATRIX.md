# Aceite — Redesign Premium F7-UX

Candidato: 9457b7ca. Matriz complementar a D01–D71; não renumera decisões.

**Registro histórico:** esta tabela descreve o estado em 9457b7ca e não é mais o cabeçalho vigente. A remediação UX-H de 13/11/2026 está em docs/superpowers/audits/f7-ux-uxh-remediation/ACCEPTANCE-MATRIX.md, candidato de código 92745e0a. Nenhum status histórico foi apagado.

## DV-01–DV-18

| DV | Status | Evidência |
|---|---|---|
| DV-01 | PASS | 12 temas em tokens e galeria; contraste amostral |
| DV-02 | PASS | galeria com prévia, persistência e reset |
| DV-03 | PASS | glow, movimento, densidade e cards com data-* |
| DV-04 | PARTIAL | hero contextual acadêmico em onboarding/dia/reta/ativa; desempenho e adaptação automática não |
| DV-05 | PARTIAL | sugestão com prévia/aceite e persistência; fixação e sessão ativa protegidas; desempenho sem teste dirigido |
| DV-06 | PARTIAL | Home recomposta e shell premium; Review/Insights/Knowledge parcialmente em painéis legados |
| DV-07 | PASS | onboarding com três passos e dispensa |
| DV-08 | PARTIAL | controles avançados sob demanda; três camadas universais não recompostas |
| DV-09 | PASS | superfícies com gradiente, borda e profundidade |
| DV-10 | PASS | Modo Foco na mesma sessão/clock |
| DV-11 | PASS | Semana/Mês/Lista com Dia e preferência |
| DV-12 | PARTIAL | fila, execução e histórico preservados, com contagens reais e próximo compromisso; composição ainda longa |
| DV-13 | PARTIAL | visão geral e recorte temporal conciliados; drill-down por entidade parcial |
| DV-14 | PARTIAL | biblioteca com contagens reais, árvore grande em 390 px; inspetor não redesenhado |
| DV-15 | PASS | Command Center, busca e Atenção deduplicada |
| DV-16 | PASS | Configurações por categorias e galeria em destaque |
| DV-17 | PARTIAL | folha de filtros em 320/390/200%; sem sistema geral de sheets |
| DV-18 | PARTIAL | feedback contextual e prioridade acadêmica; avisos persistentes na faixa/Atenção |

## VA-01–VA-20

| VA | Status | Evidência |
|---|---|---|
| VA-01 | PASS | oito temas originais preservados |
| VA-02 | PASS | quatro temas adicionais distintos |
| VA-03 | PASS_LOCAL | timer rodando/pausado com rascunho e IndexedDB intactos |
| VA-04 | PASS | preferências e reduced motion |
| VA-05 | PASS | primeiro uso sem métricas falsas |
| VA-06 | PARTIAL | dia/reta/ativa e resumo real; desempenho sem fixture dirigida |
| VA-07 | PARTIAL | sugestão com aceite, foco e anúncio; layout fixado não exercitado |
| VA-08 | PARTIAL | Home distinta; módulos parcialmente legados |
| VA-09 | PARTIAL | avançados acessíveis; três camadas parcial |
| VA-10 | PASS | sessão única e cronômetro visível em 320/390 |
| VA-11 | PASS | visões e preferência de Planejamento |
| VA-12 | PARTIAL | estados/políticas preservados; visão de fila adicionada, execução/histórico em painéis longos |
| VA-13 | PARTIAL | gráfico/tabela reconciliados em 7/30 dias; drill-down pendente |
| VA-14 | PARTIAL | biblioteca com contagens, árvore grande, mobile e teclado; inspetor básico |
| VA-15 | PASS | rotas por ID e Atenção deduplicada |
| VA-16 | PASS | Aparência isolada de operações protegidas |
| VA-17 | PARTIAL | sheet de filtros com foco/Esc/zoom; outros sheets ausentes |
| VA-18 | PASS_LOCAL | semântica T-03; diagnóstico fora do hero |
| VA-19 | PASS_LOCAL | autoridade e conflito em Foco compacto 320/390 |
| VA-20 | PASS_AUTOMATED / MANUAL_NOT_RUN | 12 temas; NVDA/hardware não |

## AC-01–AC-24

| AC | Status | Evidência |
|---|---|---|
| AC-01 | PASS_LOCAL | templates/editor/persistência |
| AC-02 | PASS_LOCAL | temas/contraste/foco |
| AC-03 | PASS_LOCAL | 320/390/tablet/desktop |
| AC-04 | PASS_LOCAL | rotas por ID/perfil |
| AC-05 | PASS_LOCAL | draft guard/foco |
| AC-06 | PASS_LOCAL | árvore/hierarquia F2 |
| AC-07 | PASS_LOCAL | cenários/capacidade F3 |
| AC-08 | PASS_LOCAL | vínculo != cumprimento |
| AC-09 | PASS_LOCAL | tempos separados |
| AC-10 | PASS_LOCAL | fila/execução F5 |
| AC-11 | PASS_LOCAL | política versionada |
| AC-12 | PASS_LOCAL | gráfico/tabela reconciliados |
| AC-13 | PASS_LOCAL | ausência != zero |
| AC-14 | PASS_LOCAL | snapshots imutáveis |
| AC-15 | PASS_LOCAL | local != outbox != ACK |
| AC-16 | PASS_LOCAL | ACK parcial |
| AC-17 | PASS_LOCAL | backup parcial não recuperável |
| AC-18 | PASS_LOCAL | rebaseline bloqueia |
| AC-19 | PASS_LOCAL | BLOCKED_UPGRADE |
| AC-20 | PASS_LOCAL | desvincular preserva fatos |
| AC-21 | PASS_LOCAL | atenção deduplicada |
| AC-22 | PASS_AUTOMATED / MANUAL_NOT_RUN | a11y automatizada |
| AC-23 | PASS_LOCAL | offline/quota |
| AC-24 | PASS_LOCAL | overview/rotas |

## Partes explicitamente não entregues

Visual: ilustração vetorial no lugar da fotocomposição; menos gráficos internos que os mockups; estúdios sem reengenharia profunda. Funcional: sem sistema geral de sheets; fixação de layout e desempenho sem teste dirigido; drill-down analítico por entidade pendente. Manual: NVDA/Narrator, toque físico e hardware modesto NOT_RUN.
