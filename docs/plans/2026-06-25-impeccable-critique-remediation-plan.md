# Plano de Remediação — Critique Impeccable (Estudo Organizado)

> **Origem:** `/impeccable critique EVERYTHING` (2026-06-25). Score **28/40 (Good, borda inferior)**.
> **Snapshot da auditoria:** `.impeccable/critique/2026-06-25T21-06-52Z__src-index-html.md`
> **Eixo mais fraco:** Consistência & Padrões (2/4) e Ajuda/Documentação (2/4).
> **Decisões do usuário (2026-06-25):**
> 1. Cor nos stat cards: **manter cor, porém somente semântica e via tokens** (não decorativa).
> 2. Prioridade: **Consistência + cor (P1) primeiro**.
> 3. Escopo desta sessão: apenas a critique (sem implementar). **Este plano é o artefato de execução para a(s) próxima(s) sessão(ões).**

---

## 0. Como usar este documento

- Cada fase é **independentemente entregável** e termina em estado verde (build + testes + validação manual).
- Os **checkpoints** (`- [ ]`) são marcáveis conforme a execução. Não pule a ordem dentro de uma fase.
- **TDD obrigatório** (ver `CLAUDE.md`): escreva/atualize o teste primeiro, veja falhar, implemente o mínimo, veja passar, refatore verde.
- Ao fim de cada fase: commit + push + atualizar o handoff (ver §10).
- **Nunca** quebre a identidade visual existente (ver §3 Guardrails).

---

## 1. Contexto da auditoria (resumo)

A auditoria cobriu **as 14 telas + o sistema de modais**, em desktop (1440px) e mobile (390px), com dados mock, no tema Grafite + verificação no Neon, e uma **auditoria programática de contraste WCAG nos 6 temas**, somada ao detector determinístico (`detect.mjs`) sobre `src`.

**Veredito anti-slop:** NÃO é slop. Identidade escura comprometida, sólida e preservada. Os "tells" de SaaS vazam apenas em **Dashboard** e **Hábitos** (stat cards multicoloridos decorativos / grade de cards idênticos).

**Pontos fortes confirmados (preservar):**
- Contraste AA verificado nos 6 temas (texto primário 13–16.5:1; secundário 7–9.7:1; `--text-muted` ≥4.5:1 em todos). Único valor sub-AA: `danger` sobre card no **Arrakis = 4.42:1**.
- Linguagem de medição (DM Mono para números, Plus Jakarta para prosa).
- Empty states que ensinam (Ciclo, Inteligência de Banca).

**Detector:** 258 achados (234 advisory, 24 warning, **0 erros de banimento absoluto**).

---

## 2. Mapa de findings → fase

| ID | Finding (severidade na critique) | Fase |
|----|----------------------------------|------|
| F1 | Dois dialetos de dashboard + stat cards multicoloridos decorativos (classes `.green/.blue/.orange/.red` com cor arbitrária) — **P1** | Fase 2 |
| F2 | Cor semântica fora de token: hexes genéricos `#f59e0b/#10b981/#ef4444/#6b7280/#3b82f6` em `layout.css`/`styles.css`/`dashboard.css` — **P2** | Fase 1 |
| F3 | Escala de raio divergente: `10px` e 2–24px fora de `--radius-sm/md/lg` (97 achados) — **P2** | Fase 1 |
| F4 | Vermelho/coral para contagens neutras ("23 Aulas Pendentes") — **P2** | Fase 2 |
| F5 | Modal de "edital principal" bloqueia a Home no 1º load — **P1** | Fase 3 |
| F6 | Escopo do edital principal faz progresso parecer 0% apesar de tempo lifetime > 0 — **minor/behavioral** | Fase 3 |
| F7 | Status só por cor (sem redundância de texto/forma): stripes de disciplina, KPIs verde/vermelho, chips do calendário — **P2 (a11y)** | Fase 4 |
| F8 | Arrakis `danger` 4.42:1 (<4.5) para texto pequeno — **P3** | Fase 4 |
| F9 | Topbar quebra no mobile (botão de tema órfão) — **P2/P3** | Fase 4 |
| F10 | Calendário com chips truncados ("Dir…") em 390px — **P2** | Fase 4 |
| F11 | Side-stripes além da exceção documentada (7×); `subject-manager` 4px accent é a decorativa — **P2/P3** | Fase 5 |
| F12 | `transition: width/height` animando layout (11×) — **P3 (perf)** | Fase 5 |
| F13 | Study Organizer top-heavy (3 cards grandes vazios); backdrop do modal dim fraco; células do calendário altas/esparsas no desktop — **minor** | Fase 6 |
| F14 | DESIGN.md ≠ código (fonte da verdade desatualizada) — **P2 (meta)** | Fase 1 + Fase 6 |

---

## 3. Guardrails de identidade (NÃO fazer)

> Estes guardrails valem para **todas** as fases. Violá-los reprova a fase.

- [ ] **NÃO** trocar a paleta escura, os 6 temas (Grafite, Ardósia, Platina, Terminal, Neon, Arrakis), nem o par tipográfico Plus Jakarta Sans + DM Mono. (O detector marca "overused-font: Plus Jakarta" — **falso positivo**, é identidade comprometida.)
- [ ] **NÃO** introduzir gradiente em texto, glassmorphism decorativo, hero-metric template, ou cinza-empresarial.
- [ ] **NÃO** remover o `inset 0 1px 0 rgba(255,255,255,0.025)` (rim-light) dos painéis.
- [ ] **NÃO** converter a escala tipográfica fixa (px) em `clamp()` fluido.
- [ ] **NÃO** mexer em `src/lab/` (Visual Layout Lab é isolado e experimental; seus achados no detector são ignorados).
- [ ] Manter contraste **AA nos 6 temas** após qualquer mudança de cor (rodar o script do Apêndice A como regressão).

---

## 4. Pré-requisitos / setup (uma vez por sessão)

```bash
# 1. Branch de trabalho
git checkout -b fix/impeccable-critique-remediation

# 2. Subir o app com dados mock (porta 18765)
npm run mock            # MOCK_MODE=reset (default) gera dataset completo
#  -> abrir http://127.0.0.1:18765

# 3. Baseline do detector (guardar contagem ANTES das mudanças)
node "C:/Users/slvma/.claude/skills/impeccable/scripts/detect.mjs" --json src > detect-baseline.json
#  baseline atual: 258 (234 advisory, 24 warning)

# 4. Baseline de testes
npm run test:unit
```

- [ ] Branch criada
- [ ] Mock server sobe e renderiza
- [ ] `detect-baseline.json` salvo (fora do versionamento; é temporário)
- [ ] Suíte de testes verde antes de começar

---

## 5. Visão geral das fases

| Fase | Tema | Prioridade | Comando Impeccable correlato | Depende de |
|------|------|-----------|------------------------------|-----------|
| 0 | Preparação, baseline e guardrails | — | — | — |
| 1 | Fundação de cor semântica + reconciliação de tokens | P2 (fundação) | `extract` | 0 |
| 2 | Unificar painéis de stat (cor semântica) + corrigir vermelho-para-pendente | **P1** | `colorize` | 1 |
| 3 | Primeiro acesso & escopo do edital principal | **P1** | `onboard` | 0 |
| 4 | Acessibilidade (redundância de cor, Arrakis, mobile) | P2 | `audit` | 1 |
| 5 | Side-stripes documentadas + movimento/perf | P2/P3 | `animate` | 1 |
| 6 | Minors, DESIGN.md como contrato, polish + re-critique | P2/P3 | `polish` | 1–5 |

> **Ordem recomendada de execução:** 0 → 1 → 2 → 3 → 4 → 5 → 6.
> A Fase 1 vem antes da 2 porque "cor semântica via token" exige os tokens consolidados. As Fases 3, 4 e 5 são independentes entre si e podem ser paralelizadas após a 1.

---

## Fase 0 — Preparação, baseline e guardrails

**Objetivo:** Garantir ambiente, baselines e rede de segurança antes de qualquer mudança. Zero alteração de comportamento.

**Passos**
1. Cumprir o §4 (branch, mock, baselines).
2. Adicionar o **script de auditoria de contraste** (Apêndice A) como teste de regressão reutilizável em `tests/unit/contrast-themes.test.js` (jsdom + leitura de tokens). Caso jsdom não compute `getComputedStyle` de variáveis encadeadas de forma confiável, manter o script como utilitário Node em `scripts/contrast-audit.mjs` que carrega `tokens.css` + `themes.css` e calcula os ratios — e rodá-lo no CI.
3. Rodar o teste/utilitário e **gravar os ratios atuais** como baseline (snapshot inline no teste).

**Checkpoints**
- [ ] Script/teste de contraste roda e reproduz: primário 13–16.5, secundário 7–9.7, muted ≥4.5 nos 6 temas, Arrakis danger ≈4.42.
- [ ] `npm run lint` e `npm run test:unit` verdes.
- [ ] Baseline do detector arquivado.

**Critério de aceite:** baseline de contraste e detector reprodutíveis; suíte verde.
**Rollback:** nenhum (sem mudança funcional).
**Git:** `chore(test): baseline de contraste e detector para remediação da critique`.

---

## Fase 1 — Fundação de cor semântica + reconciliação de tokens

**Objetivo (F2, F3, F14):** Fazer o `tokens.css` + `DESIGN.md` voltarem a ser a **fonte da verdade**. Consolidar nomes semânticos, eliminar hexes genéricos e alinhar a escala de raio ao uso real. **Sem mudar a aparência** (refactor de equivalência visual).

**Arquivos**
- `src/css/tokens.css` (tokens — raiz)
- `src/css/base/themes.css` (overrides por tema; só validar, não reescrever)
- `src/css/base/layout.css` (hexes genéricos: ~L127, L132, L156, L160, L164, L168 — `#f59e0b/#10b981/#ef4444/#6b7280`)
- `src/css/styles.css`, `src/css/views/dashboard.css` (demais hexes flagados)
- `src/css/components/buttons.css` (raio `10px` L6/L90), `src/css/components/cards.css` (raio `10px` L112), `src/css/base/accessibility.css` (raio `4px` L18)
- `DESIGN.md` (frontmatter `colors` + `rounded`)
- `tests/unit/css-architecture.test.js` (teste de arquitetura de CSS — estender)

**Contexto técnico (já verificado):**
- Tokens semânticos **já existem**: `--success/--warning/--danger/--info` (+ `-bg`) e aliases legados `--green/--red/--orange/--yellow/--blue/--purple`. O problema é uso de hexes crus **em vez** desses tokens, e a duplicidade de aliases.
- Escala de raio documentada: `--radius-sm:8 / --radius-md:14 / --radius-lg:18 / --radius-pill:999`. Componentes usam `10px` (botões/cards), `4px`, etc. — fora da escala.

**Abordagem TDD**
1. Estender `css-architecture.test.js` com asserts que **falham hoje**:
   - nenhum hex de cor cru fora de `tokens.css`/`themes.css` (regex sobre os arquivos de componente/view; allowlist para `themes.css` e `lab/`);
   - todo `border-radius` usa `var(--radius-*)` (allowlist temporária a remover ao longo da fase).
2. Ver falhar (vermelho). Implementar. Ver passar (verde).

**Passos**
1. **Raio:** adicionar tokens que faltam e documentar:
   - `--radius-xs: 4px;` (foco/checkbox/chips finos) e `--radius-control: 10px;` (botões/inputs/cards interativos) em `tokens.css`.
   - Substituir `10px` → `var(--radius-control)` em `buttons.css`/`cards.css`; `4px` → `var(--radius-xs)` em `accessibility.css`; varrer os demais raios off-scale (2,3,5,6,7,12,16,20,24px) e mapear ao token mais próximo OU promover a token nomeado se intencional.
   - Atualizar `DESIGN.md` › `rounded` para incluir `xs: 4px` e `control: 10px` (passa a refletir o código).
2. **Cor:** substituir cada hex genérico pelo token semântico equivalente:
   - `#10b981/#22c55e/#2ec27e` → `var(--success)`; `#ef4444/#d64545` → `var(--danger)`; `#f59e0b/rgb(220,165,30)` → `var(--warning)`; `#3b82f6/#4ea1ff` → `var(--info)`/`--accent`; `#6b7280/#888/#aab` → `var(--text-muted)`/`--neutral-strong`.
   - rgba pretas de sombra → consolidar nos tokens `--shadow*`.
   - **Validar equivalência visual:** comparar screenshot antes/depois (deve ser pixel-equivalente onde a cor era visualmente igual; onde mudar, é porque o hex divergia do token — anotar e confirmar que aproxima da identidade).
3. **Consolidar aliases:** decidir nomes canônicos (`--success/--warning/--danger/--info`) e manter os legados (`--green` etc.) como `--green: var(--success)` para não quebrar usos existentes. Documentar a política no DESIGN.md.
4. Rodar o detector: a contagem de `design-system-color` e `design-system-radius` deve **cair drasticamente** (alvo: < 40 advisories totais, restando apenas `themes.css` legítimo e `lab/`).

**Checkpoints**
- [ ] Tokens `--radius-xs` e `--radius-control` criados e documentados no DESIGN.md
- [ ] Raios off-scale substituídos por tokens (exceto allowlist justificada)
- [ ] Hexes genéricos substituídos por tokens semânticos
- [ ] Aliases legados apontando para tokens canônicos
- [ ] `css-architecture.test.js` atualizado e verde
- [ ] Detector: `design-system-color` + `design-system-radius` reduzidos a apenas `themes.css`/`lab/` (anotar nova contagem)
- [ ] Contraste AA nos 6 temas mantido (Apêndice A verde)
- [ ] Screenshots antes/depois confirmam equivalência visual

**Critério de aceite:** DESIGN.md descreve fielmente o CSS; detector silenciado para drift legítimo; nenhuma regressão visual; AA preservado.
**Riscos:** substituição de cor que muda aparência onde o hex divergia do token. **Mitigação:** diff visual por tela; se a cor "certa" (token) for pior, criar token nomeado em vez de forçar.
**Rollback:** `git revert` da fase (mudança isolada em CSS/tokens).
**Git:** `refactor(tokens): reconciliar cor semântica e escala de raio com o código (DESIGN.md fonte da verdade)`.

---

## Fase 2 — Unificar painéis de stat com cor semântica (P1)

**Objetivo (F1, F4):** Eliminar os dois dialetos de dashboard e a cor decorativa. Decisão do usuário: **manter cor, porém somente semântica e via token**. Cada cor passa a significar algo (categoria ou estado), nunca enfeite por card.

**Arquivos**
- `src/css/components/cards.css` (L45–104: `.stat-card`, `.stat-card.green/.blue/.orange/.red::before`, `.stat-label/.stat-value/.stat-sub`)
- `src/css/views/dashboard.css` (`.dashboard-stat-value*`, layout dos KPIs da Home)
- `src/js/views/dashboard-view.js` (`renderDashboard`: 4 cards `stat-card green/blue/orange/red`; `renderHabitSummary`)
- `src/js/views/habitos-view.js` + `src/css/views/habitos.css` (grade 3×3 de 9 cards idênticos)
- `src/js/views/home-view.js` (`renderLifetimeKpis`/`renderWeekKpis`: classe `dashboard-stat-detail--negative` usada para "Aulas Pendentes")
- `src/css/base/layout.css` (regras `dashboard-stat-detail--positive/negative`)
- `tests/unit/views-dashboard.test.js`, `tests/unit/views.test.js`

**Contexto técnico (já verificado):**
- As classes de cor do stat-card **mentem**: `.green::before → var(--accent)`, `.blue::before → var(--blue)` (== `--accent`, #8aa4bf). Logo "Tempo", "Sessões" etc. recebem cor arbitrária e em parte idêntica. É isto que lê como "qualquer startup".

**Abordagem TDD**
1. Teste em `views-dashboard.test.js`: assert que cada stat-card do Dashboard recebe uma classe **semântica** (ex.: `stat-card--tempo`, `stat-card--questoes`, `stat-card--simulados`) mapeada a um token de **categoria/estado**, e que NÃO existem mais classes de cor genéricas (`.green/.blue/.orange/.red`). Ver falhar.
2. Teste: "Aulas Pendentes" (e contagens "restantes") **não** usam a classe de cor de erro/`negative`. Ver falhar. Implementar.

**Passos**
1. **Definir o sistema semântico de cor de stat** (1 decisão, documentar no DESIGN.md):
   - Opção recomendada: cor = **categoria de dado** (tempo→`--info`/accent, questões→`--question`/roxo, páginas→`--text-secondary`, simulados→`--warning`), aplicada de forma consistente em **Home, Dashboard, Editais Anteriores e Hábitos** (mesma categoria = mesma cor em toda a app).
   - Alternativa: cor = **estado** (verde sucesso/atrás/etc.) só quando houver estado real; senão neutro.
2. **Renomear classes** `.green/.blue/.orange/.red` → classes de categoria/estado semânticas; remover o mapeamento arbitrário. `cards.css::before` passa a usar o token da categoria.
3. **Unificar vocabulário** entre `renderHome` (Home) e `renderDashboard` (Dashboard): mesma régua de stat-card (mesmo componente/markup) para acabar com os dois dialetos. Idealmente um único helper de stat-card reutilizado.
4. **Hábitos:** introduzir hierarquia na grade de 9 cards — destacar 2–3 métricas-chave (ex.: Questões, Páginas, Tempo) e reduzir o peso visual das demais (densidade com hierarquia, não 9 pesos iguais). Cor só semântica (categoria do hábito), via token. Remover os sublinhados coloridos decorativos.
5. **Vermelho-para-pendente:** trocar `dashboard-stat-detail--negative` por neutro (`--text-secondary`/`--text-muted`) em contagens **restantes/pendentes**; reservar `--danger` para erro/`atrasado`. Aplicar em Home (desktop e mobile) e onde mais houver "pendentes" em coral.

**Checkpoints**
- [ ] Classes `.green/.blue/.orange/.red` removidas; substituídas por classes semânticas
- [ ] Mesma categoria de dado = mesma cor em Home/Dashboard/Editais Anteriores/Hábitos
- [ ] Home e Dashboard usam o **mesmo** vocabulário de stat-card (sem dois dialetos)
- [ ] Hábitos com hierarquia (não 9 pesos iguais) e sem sublinhado decorativo
- [ ] "Aulas/itens pendentes/restantes" em cor neutra; coral só para erro/atrasado
- [ ] DESIGN.md: seção "cor de stat = semântica" documentada
- [ ] `views-dashboard.test.js`/`views.test.js` verdes; contraste AA mantido (Apêndice A)
- [ ] Screenshots de Home, Dashboard, Editais Anteriores e Hábitos revisados

**Critério de aceite:** nenhuma cor decorativa em stat cards; um único dialeto de dashboard; coral só para perigo/atraso; identidade preservada.
**Riscos:** mexer em markup compartilhado pode afetar telas que reusam `renderDashboard` (Editais Anteriores reusa). **Mitigação:** testar Dashboard **e** Editais Anteriores; rodar `test:views`.
**Rollback:** `git revert` (CSS + 3 views).
**Git:** `fix(dashboard): unificar stat cards em cor semântica via token; remover cor decorativa e vermelho-para-pendente`.

---

## Fase 3 — Primeiro acesso & escopo do edital principal (P1)

**Objetivo (F5, F6):** A Home é a tela de "o que faço agora"; ela não pode ser bloqueada por modal no 1º load, nem mostrar progresso enganosamente baixo.

**Arquivos**
- `src/js/app.js` (L99–102: bootstrap chama `reconcilePrincipalEdital()` no 1º open)
- `src/js/views/editais-crud.js` (`reconcilePrincipalEdital` → dispara o `modal-prompt` "Qual é seu edital principal?")
- `src/js/edital-filter.js` / `src/js/logic.js` (`getPrincipalEditalId`, escopo)
- `src/js/views/home-view.js` (`renderHome`: KPIs escopados ao principal)
- `tests/unit/` (criar `principal-edital-bootstrap.test.js`) + e2e mock (`tests/e2e/mock-environment.spec.js`)

**Abordagem TDD**
1. Teste de bootstrap: ao abrir sem `principalEditalId` definido e com ≥1 edital, **não** abrir modal bloqueante; em vez disso, expor CTA inline na Home. Ver falhar.
2. Teste de escopo: quando o tempo lifetime > 0 mas o edital principal não tem questões, a Home **não** deve transmitir "0% / sem progresso" como se nada existisse (decidir regra — ver passo 3). Ver falhar.

**Passos**
1. **Substituir o modal bloqueante** por:
   - um **banner dismissível** no topo da Home ("Defina seu edital principal para focar o painel") com select inline, **ou**
   - default para **escopo "todos os editais"** até o usuário promover um principal a partir de `Editais` (ação `make-edital-principal` já existe em `ui/actions/editais.js:93`).
2. Garantir que o app é **utilizável sem escolher** (não trava a Home).
3. **Escopo F6:** decidir e documentar a régua:
   - (a) Home default = **todos os editais** (mostra o quadro completo; promove confiança nos números), com filtro opcional para o principal; **ou**
   - (b) manter escopo no principal, mas exibir um aviso claro ("Exibindo apenas o edital principal — N% do total") para que 0% não seja lido como "nenhum progresso".
   - Validar consistência com `getAggregatedStats` / Histórico / Dashboard (mesma régua de data/escopo).
4. e2e mock: cobrir 1º load (sem modal) + alternância de escopo.

**Checkpoints**
- [x] 1º load **não** abre modal bloqueante; Home visível imediatamente
- [x] Seleção de edital principal disponível inline / via Editais, sem travar
- [x] Regra de escopo decidida: opção (a), Home default = todos os editais ativos enquanto a escolha do principal estiver pendente
- [x] Home não comunica "0%/sem progresso" enganoso quando há dados lifetime
- [x] Testes unit verdes para bootstrap sem modal, CTA inline e escopo agregado pendente
- [ ] e2e mock verde
- [ ] Validação manual: abrir mock em modo `reset` e `clean` (app vazio) — ambos sem bloqueio

**Critério de aceite:** Home utilizável e honesta no 1º acesso; "o que faço agora" claro em ≤5s.
**Riscos:** mexer em escopo afeta muitas telas (Home, Dashboard, Calendário, Revisões). **Mitigação:** rodar `test:views` + `test:e2e:mock:all`; revisar cada tela escopada.
**Rollback:** `git revert`; o modal antigo pode ser reativado por flag se preciso.
**Git:** `fix(onboarding): remover modal bloqueante de edital principal e corrigir leitura de escopo na Home`.

---

## Fase 4 — Acessibilidade (P2)

**Objetivo (F7, F8, F9, F10):** Status não pode depender só de cor; corrigir o único contraste sub-AA; resolver quebras mobile.

**Arquivos**
- `src/js/views/calendar-view.js` (chips L188/262/312/367 `border-left:3px solid ${cor}`; densidade mobile)
- `src/css/views/calendar.css`
- `src/js/views/home-view.js` (KPIs verde/vermelho — adicionar rótulo/ícone)
- `src/css/base/themes.css` (Arrakis `--danger`)
- `src/css/components/sidebar.css` + topbar (CSS do `.topbar`/`#topbar-actions` em `styles.css`/`views.css`)
- `src/css/base/mobile.css`
- `tests/unit/contrast-themes.test.js` (Fase 0)

**Abordagem TDD**
1. Teste de contraste: Arrakis `danger`/card deve passar a **≥4.5:1**. Ver falhar → ajustar token → ver passar.
2. (Onde testável) assert de que estados de status expõem texto/aria além da cor.

**Passos**
1. **Redundância de cor (F7):** adicionar rótulo textual, ícone ou forma a todo status hoje só-cor:
   - chips do calendário e stripes de disciplina: já têm nome; garantir que a **distinção** não dependa só do matiz (ex.: prefixo/ícone por estado agendado/estudei/atrasado).
   - KPIs "acertos/erros" e barras: rótulo textual explícito (já há "Acertos/Erros" — garantir em todos os pontos; o doughnut/legendas idem).
2. **Arrakis danger (F8):** clarear `--danger` no tema Arrakis até **≥4.5:1** sobre `--card` (hoje 4.42). Revalidar os outros temas não regridem.
3. **Topbar mobile (F9):** corrigir o wrap — o botão de tema não pode órfão. Revisar `flex-wrap`/ordem/colapso da topbar em ≤480px (mover ações secundárias para um menu ou segunda linha intencional).
4. **Calendário mobile (F10):** em 390px, evitar chips truncados a "Dir…": ou priorizar a visão **Semana** no mobile, ou indicador compacto (ponto + contador) com detalhe no painel "Dia selecionado".
5. Conferir alvos de toque ≥44px (já implementado para `pointer: coarse`).

**Checkpoints**
- [x] Nenhum status depende exclusivamente de cor nos chips do calendário (marcador visível + `aria-label` textual)
- [x] Arrakis `danger`/card ≥4.5:1; demais temas sem regressão (Apêndice A verde)
- [x] Topbar mobile sem botão órfão (testado em 360/390/414px via Playwright headed)
- [x] Calendário legível em 390px (chip mobile sem ellipsis; título pode quebrar linha)
- [x] Alvos de toque ≥44px confirmados por regras existentes `pointer: coarse`/44px

**Critério de aceite:** persona Sam (a11y) sem red flags de cor-only; AA total nos 6 temas; mobile sem quebras.
**Riscos:** clarear Arrakis danger pode aproximar de warning. **Mitigação:** checar distância perceptual + contraste.
**Rollback:** `git revert` por arquivo.
**Git:** `fix(a11y): redundância de status além de cor, Arrakis danger AA e correções de topbar/calendário mobile`.

---

## Fase 5 — Side-stripes documentadas + movimento/perf (P2/P3)

**Objetivo (F11, F12):** Alinhar as faixas laterais à regra do próprio design system e parar de animar propriedades de layout.

**Arquivos**
- `src/css/styles.css` (L2281 `border-left:4px var(--session-disc-color)`; L1516 `transition: width`)
- `src/css/views/dashboard.css` (L105 `border-left:4px var(--predictive-status-color)`; L66 `transition: height`; L344/490/526 `transition: width`)
- `src/css/views/subject-manager.css` (L125 `border-left:4px var(--accent)` — **a decorativa**)
- `src/js/views/calendar-view.js` (chips 3px — categoria/estado, manter)
- `src/css/components/sidebar.css` (L29 `transition: width`), `src/css/components/status-feedback.css` (L13), `src/css/views.css` (L94/642), `src/css/components/cards.css`
- `DESIGN.md` (seção Components / Do's & Don'ts)
- `src/css/base/animations.css`

**Abordagem TDD**
1. Teste (css-architecture): nenhuma `transition` em `width`/`height` fora de allowlist justificada; ver falhar.
2. Detector: `side-tab` deve restar apenas nos casos documentados como exceção (status/categoria), `layout-transition` → 0 fora da allowlist.

**Passos**
1. **Documentar a exceção ampliada** no DESIGN.md: "faixa lateral de 3–4px é permitida quando codifica **status** (event-card, card preditivo) ou **categoria** (disciplina em linhas/chips). Proibida como enfeite."
2. **Remover a decorativa:** `subject-manager.css:125` (`border-left:4px var(--accent)`) — substituir por borda completa fina, fundo tingido, ou nada.
3. **Movimento:** trocar `transition: width/height` por `transform: scaleX/scaleY` (barras de progresso) com `transform-origin` correto; sidebar collapse pode manter `width` se necessário, mas avaliar `transform`. Garantir `@media (prefers-reduced-motion: reduce)` (crossfade/instantâneo) para todas.
4. Revalidar visualmente as barras de progresso (Home, Dashboard, Verticalizado, Revisões).

**Checkpoints**
- [x] DESIGN.md documenta a regra de faixa lateral (status/categoria) e a proíbe como enfeite
- [x] `subject-manager` accent stripe removida/reescrita
- [x] Barras de progresso animam via `transform`, não `width`
- [x] `prefers-reduced-motion` cobre todas as animações tocadas
- [x] Detector: `layout-transition` → 0 (fora de allowlist); `side-tab` só nos casos documentados
- [x] Validação visual das barras

**Critério de aceite:** faixas laterais consistentes com a regra documentada; sem animação de layout; reduced-motion respeitado.
**Riscos:** `scaleX` distorce conteúdo interno da barra (labels). **Mitigação:** animar só o preenchimento, não o container com texto.
**Rollback:** `git revert` por arquivo.
**Git:** `refactor(motion): faixas laterais por regra documentada e progress bars via transform`.

---

## Fase 6 — Minors, DESIGN.md como contrato, polish e re-critique

**Objetivo (F13, F14):** Acabamento, transformar DESIGN.md em contrato verificável e medir o ganho.

**Passos**
1. **Study Organizer top-heavy:** reduzir o peso dos 3 stat cards quando o dia está vazio (estado compacto) e dar mais destaque a "Próximos 7 dias".
2. **Backdrop do modal:** aumentar o dim do overlay para o modal comandar foco (sem virar glassmorphism).
3. **Calendário desktop:** densificar células altas/esparsas (altura proporcional, mais respiro útil).
4. **DESIGN.md como contrato (F14):** decidir com o usuário se o `css-architecture.test.js` + detector entram no `npm run ci` como **guardrail** (lint de design) — se sim, ligar no CI.
5. **Re-rodar a critique:** `/impeccable critique` (ou re-rodar detector + script de contraste) e comparar com 28/40. Atualizar o snapshot.
6. **`/impeccable polish`** como passada final de acabamento.

**Checkpoints**
- [x] Study Organizer com estado compacto quando vazio
- [x] Backdrop do modal comanda foco
- [x] Calendário desktop mais denso/equilibrado
- [ ] Decisão sobre lint de design no CI registrada (e ligado, se aprovado)
- [ ] Re-critique executada; score comparado (alvo: Consistência 2→3+, total ≥32)
- [ ] Snapshot da critique atualizado

**Critério de aceite:** score sobe (especialmente Consistência); DESIGN.md reflete e/ou força o código.
**Git:** `polish(ui): acabamento final pós-remediação + DESIGN.md como contrato`.

---

## 6. Métricas de sucesso (definição de "pronto")

| Métrica | Antes | Alvo |
|---------|-------|------|
| Design Health (Nielsen) | 28/40 | ≥ 32/40 |
| Consistência & Padrões | 2/4 | ≥ 3/4 |
| Detector `design-system-color` | 136 | só `themes.css`/`lab/` |
| Detector `design-system-radius` | 97 | ~0 fora de token |
| Detector `layout-transition` | 11 | 0 fora de allowlist |
| Contraste AA (6 temas) | 1 falha (Arrakis 4.42) | 0 falhas |
| Cor decorativa em stat cards | sim | não |
| Modal bloqueante no 1º load | sim | não |

---

## 7. Comandos úteis

```bash
npm run mock                 # app com dados mock (porta 18765, modo reset)
npm run mock:clean           # app vazio (testar empty states)
npm run lint                 # eslint src/
npm run test:unit            # vitest (unit)
npm run test:views           # suíte de views
npm run test:e2e:mock:all    # e2e no ambiente mock
npm run format:check         # prettier (ver nota CRLF no Windows abaixo)
node "C:/Users/slvma/.claude/skills/impeccable/scripts/detect.mjs" --json src   # detector
```

> **Nota Windows/CRLF:** `format:check` pode falhar por diferença de fim de linha (autocrlf). É ambiental — não rodar `prettier --write` em massa por causa disso.

---

## 8. Apêndice A — Script de auditoria de contraste (regressão)

Roda no browser (ou adaptar para Node carregando `tokens.css`+`themes.css`). Itera os 6 temas e calcula os ratios WCAG dos pares críticos. **Falha** se algum par de corpo < 4.5:1 (texto grande < 3:1).

```js
() => {
  const themes = ['grafite','ardosia','platina','terminal','neon','arrakis'];
  const root = document.documentElement; const prev = root.getAttribute('data-theme');
  const parse = (c) => { const x=document.createElement('canvas').getContext('2d'); x.fillStyle='#000'; x.fillStyle=c.trim(); const v=x.fillStyle;
    if(v[0]==='#') return [parseInt(v.slice(1,3),16),parseInt(v.slice(3,5),16),parseInt(v.slice(5,7),16),1];
    const m=v.match(/rgba?\(([^)]+)\)/); const p=m[1].split(',').map(parseFloat); return [p[0],p[1],p[2],p[3]??1]; };
  const blend=(f,b)=>{const a=f[3];return [f[0]*a+b[0]*(1-a),f[1]*a+b[1]*(1-a),f[2]*a+b[2]*(1-a),1];};
  const L=(r)=>{const s=r.slice(0,3).map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});return .2126*s[0]+.7152*s[1]+.0722*s[2];};
  const ratio=(f,b)=>{const ff=f[3]<1?blend(f,b):f;const l1=L(ff),l2=L(b);return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);};
  const get=(v)=>getComputedStyle(root).getPropertyValue(v);
  const out={};
  for(const t of themes){ root.setAttribute('data-theme',t); const card=parse(get('--card'));
    out[t]={ primary:ratio(parse(get('--text-primary')),card), secondary:ratio(parse(get('--text-secondary')),card),
      muted:ratio(parse(get('--text-muted')),card), danger:ratio(parse(get('--danger')),card),
      success:ratio(parse(get('--success')),card), warning:ratio(parse(get('--warning')),card) };
  }
  root.setAttribute('data-theme',prev); return out;
}
```

**Baseline (2026-06-25):** primary 13–16.5 | secondary 7–9.7 | muted 4.56–5.09 | danger 4.42 (Arrakis) a 6.96 (Terminal).

---

## 9. Apêndice B — Findings descartados (não agir)

- `overused-font: Plus Jakarta Sans` → identidade comprometida (preservar).
- `numbered-section-markers` → o wizard de planejamento e a Inteligência de Banca são **sequências reais** (justificado).
- Cores em `src/css/base/themes.css` → definições legítimas dos 6 temas.
- Tudo em `src/lab/` → isolado/experimental (não tocar).

---

## 10. Handoff & GitHub (ao fim de cada fase)

```bash
git add .
git commit -m "<tipo>(<escopo>): <descrição>"
git push -u origin fix/impeccable-critique-remediation
```

- [ ] Atualizar handoff em `docs/handoffs/handoff-AAAA-MM-DD-impeccable-remediacao.md` com: o que foi feito, arquivos alterados, testes, status, pendências e próximo passo.
- [ ] Ao concluir todas as fases: re-rodar `/impeccable critique` e registrar o novo score.

---

> **Resumo:** o app já passa no teste anti-slop; este plano é sobre **rigor e consistência** — fazer o código e o DESIGN.md voltarem a contar a mesma história, com cor sempre semântica, primeiro acesso desbloqueado, e acessibilidade redundante. Identidade escura: **preservar sempre**.
