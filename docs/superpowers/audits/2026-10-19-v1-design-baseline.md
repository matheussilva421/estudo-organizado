# Baseline visual e auditoria Impeccable da V1 (F0)

**Data da execução:** 2026-10-28 (America/Fortaleza)
**Branch:** `v2`
**Escopo:** auditoria visual read-only da V1 em ambiente mock isolado, sem dados reais, sem produção e sem alteração de `PRODUCT.md`, `DESIGN.md` ou `.impeccable/`.
**Ferramenta:** Impeccable 3.9.1 (skill instalada em `C:\\Users\\slvma\\.agents\\skills\\impeccable`), executada conforme a Emenda A-01.

## Instalação e configuração verificadas

- `PRODUCT.md` (register `product`) e `DESIGN.md` lidos por `scripts/context.mjs`.
- `.impeccable/design.json` schemaVersion 2 e `.impeccable/live/config.json` inspecionados; nenhum `init`, hook ou telemetria foi habilitado.
- O projeto não possui `.agents/skills/impeccable`; a skill global foi usada apenas como processo de auditoria.
- Nenhum arquivo canônico de design foi sobrescrito. Não houve custo, rede externa ou serviço pago.

## Comandos executados

| Verificação | Comando/caminho | Resultado |
| --- | --- | --- |
| Contexto | `node <skill>/scripts/context.mjs` | PRODUCT.md/DESIGN.md carregados; register `product` |
| Detector | `node <skill>/scripts/detect.mjs --json src` | 162 achados: 9 warning, 153 advisory |
| Contraste | `npm run test:design` | 45 testes PASS; AA de corpo nos 8 temas |
| Capturas | Playwright + `scripts/local-mock-server.mjs` | 24 imagens (8 temas x desktop/tablet/mobile) |
| Métricas | Playwright Navigation Timing | DCL 398–544 ms; load 612–652 ms; 634 nós |
| Teclado | Tab 8x no desktop | skip links primeiro; foco visível em 7/8 amostras |

## Audit Health Score

| # | Dimensão | Nota | Achado principal |
| --- | --- | --- | --- |
| 1 | Acessibilidade | 3/4 | Contraste AA nos 8 temas, skip links e foco visível; leitor de tela e zoom 200% não auditados |
| 2 | Performance | 3/4 | Carregamento local ~0,6 s e 634 nós; animação de `width` e ausência de profiling real |
| 3 | Responsivo | 3/4 | Sem overflow em 1440/834/390; fluxos completos e zoom não cobertos |
| 4 | Tematização | 3/4 | 8 temas distintos e tokens fortes; 41 cores e 110 tamanhos fora do ramp documentado |
| 5 | Anti-padrões | 3/4 | Identidade própria e densa; 3 side-tabs e toasts sobrepostos |
| **Total** | | **15/20** | **Good** |

## Veredito de anti-padrões

**Não parece um template SaaS genérico.** A paleta escura, a hierarquia densa e o par Plus Jakarta Sans + DM Mono preservam a identidade aprovada. Não há gradiente em texto, glassmorphism decorativo, hero-metric de SaaS nem card grid idêntico.

Os sinais do detector são majoritariamente de sistema de design, não de “slop”: 110 tamanhos de fonte fora do ramp documentado, 41 cores específicas de temas e 3 bordas laterais coloridas. O uso de Plus Jakarta Sans foi sinalizado como fonte superutilizada, mas é uma escolha identitária explícita da V1 e fica preservado por A-01; não é regressão.

## Achados por severidade

### P0 — bloqueante

Nenhum achado P0 na amostra executada.

### P1 — maior

**Toasts empilhados cobrem conteúdo e ações primárias.**
- **Local:** `src/css/components/feedback.css`/`toast` (comportamento observado nas capturas `desktop-grafite.png`, `desktop-plasma.png` e `tablet-ardosia.png`).
- **Categoria:** Responsivo / Acessibilidade.
- **Impacto:** no desktop e no tablet, dois avisos simultâneos cobrem “Iniciar sessão”, cards de metas e parte do dashboard. O usuário precisa esperar ou fechar avisos para agir.
- **Recomendação:** limitar a 1–2 toasts visíveis, empilhar em região reservada, pausar o timer no hover/foco e permitir dispensa em lote.
- **Comando sugerido:** `$impeccable adapt` e `$impeccable polish` na F6.

### P2 — menor

1. **Contradição de métrica na Home do mock.** “TEMPO DE ESTUDO 61:02:00” aparece com “Sem registros esta semana”.
   - **Evidência:** `desktop-grafite.png`, `tablet-ardosia.png`, `mobile-grafite.png`.
   - **Impacto:** quebra a confiança no painel; pode ser artefato do seed sintético, mas a UI não sinaliza a inconsistência.
   - **Recomendação:** reconciliar seed e texto na F0/F1; não corrigir a V1 nesta auditoria.
2. **110 tamanhos de fonte fora do ramp de DESIGN.md** (incluindo 9 px e 10 px em `src/css/base/layout.css:382,390`).
   - **Impacto:** labels muito pequenos em telas densas; risco de legibilidade em mobile.
   - **Recomendação:** documentar os passos intencionais ou migrar para o ramp na V2/F6.
3. **41 cores fora da paleta base de DESIGN.md**, concentradas em `src/css/base/themes.css`.
   - **Impacto:** drift de tokens entre os 8 temas; manutenção e contraste mais difíceis.
   - **Recomendação:** classificar como tokens de tema documentados na spec V2; não alterar a V1.
4. **3 bordas laterais coloridas** (`src/css/styles.css:2390`, `src/css/views/dashboard.css:112`, `src/js/views/calendar-view.js:62`).
   - **Impacto:** o padrão é apontado como anti-padrão visual; aqui codifica disciplina/status.
   - **Recomendação:** avaliar borda completa, tint de fundo ou ponto de cor na V2, preservando o código de cor.
5. **Animação de `width` em barras de progresso** (`src/css/views/reta-final.css:353`).
   - **Impacto:** pode causar layout thrash em listas grandes.
   - **Recomendação:** animar `transform: scaleX` com `prefers-reduced-motion`.
6. **Avisos duplicados e alarmistas** (“Revisões Pendentes” + “Meta Semanal em Alto Risco”, com emojis ⚠️) na mesma carga.
   - **Impacto:** ruído e tom acima do “factual, não vendedor” do PRODUCT.md.
   - **Recomendação:** consolidar em um resumo e reservar emoji para estado crítico real.

### P3 — polimento

- Um controle (recolher sidebar) usa outline default de 1 px, enquanto os demais usam 2 px; uniformizar na V2.
- A sequência 01–04 sinalizada pelo detector é um wizard real; o uso é legítimo e não requer ação.
- Plus Jakarta Sans sinalizada como “overused font”; decisão identitária preservada por A-01.

## Contraste por tema (saída real de `npm run test:design`)

| Tema | text-primary | text-secondary | text-muted | danger | success | warning | accent |
| --- | --- | --- | --- | --- | --- | --- | --- |
| grafite | 16.45 | 9.72 | 5.09 | 6.43 | 9.98 | 8.07 | 6.91 |
| ardosia | 14.54 | 7.31 | 4.57 | 5.88 | 9.26 | 7.38 | 9.40 |
| platina | 14.48 | 7.11 | 4.60 | 6.08 | 8.85 | 7.22 | 11.04 |
| terminal | 15.28 | 9.07 | 4.57 | 6.96 | 13.52 | 10.16 | 13.52 |
| neon | 14.83 | 8.36 | 4.56 | 5.31 | 9.58 | 10.01 | 10.86 |
| arrakis | 13.05 | 7.99 | 4.61 | 4.64 | 7.02 | 7.10 | 7.10 |
| codex | 14.91 | 8.49 | 5.52 | 5.83 | 13.16 | 9.56 | 6.81 |
| plasma | 13.40 | 6.68 | 4.70 | 5.54 | 9.10 | 10.48 | 9.21 |

Todos os valores de corpo ficam ≥ 4.5:1. O pior `text-muted` é 4.56:1 (neon), no limite do AA; não há folga para reduzir opacidade.

## Evidências visuais

As capturas foram feitas em `http://127.0.0.1:18766` com mock isolado e `reducedMotion: reduce`. Apenas quatro amostras foram preservadas no repositório; as outras 20 ficaram em diretório temporário.

| Arquivo | Viewport | Tema | SHA-256 |
| --- | --- | --- | --- |
| `evidence/desktop-grafite.png` | 1440x900 | Grafite | `D8AF0B5128B36E3DD67A081F705BD04DAF44D901C9A11526655C333464EB8D1A` |
| `evidence/desktop-plasma.png` | 1440x900 | Plasma | `1AEC647F762B41CF57DD963732301EA931039E2DEF39220BEC6E0D74EDA1BE70` |
| `evidence/tablet-ardosia.png` | 834x1112 | Ardósia | `1C6403EDD78938CD28AB8619012F2127FA9F06DCD5E522D6442132EE5EFC7B91` |
| `evidence/mobile-grafite.png` | 390x844 | Grafite | `AABBB472977655121EB1AE3D4D2E2F2CC9557DC2A7F61BA1C10D107063FE2445` |

## Pontos fortes

- Os oito temas são visualmente distintos e mantêm a identidade escura, sem colapso para um único tema.
- Números em DM Mono, labels curtos e hierarquia densa reforçam “precisão é a estética”.
- Skip links vêm primeiro na tabulação; foco visível de 2 px é consistente na maioria dos controles.
- Há regras explícitas de 44 px para `pointer: coarse` e `prefers-reduced-motion` no CSS.
- Sem overflow horizontal em 1440, 834 e 390; nenhum erro de console na Home do mock.

## Limites da auditoria

- Somente ambiente mock local; nenhum dado real, produção, Firebase ou Cloudflare foi acessado.
- Não houve leitor de tela, zoom 200%, auditoria de todos os fluxos nem teste com usuários.
- O detector é estático e não prova qualidade visual; os falsos positivos foram justificados acima.
- A nota 15/20 mede a amostra executada, não homologação final da V1.

## Próximos comandos recomendados (F6, não executados)

1. `$impeccable adapt` — corrigir a sobreposição de toasts e a hierarquia em tablet.
2. `$impeccable typeset` — reconciliar o ramp tipográfico e os labels de 9–10 px.
3. `$impeccable colorize` — documentar/consolidar as cores específicas dos 8 temas.
4. `$impeccable polish` — fechar foco, side-tabs e animação de progresso.

Estes comandos alteram UI e só podem ser executados na V2, após spec/plano e aceite humano da F0.
