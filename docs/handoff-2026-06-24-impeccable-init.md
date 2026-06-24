# Handoff — Impeccable Init (contexto de design)

**Data:** 2026-06-24
**Escopo:** Inicialização do contexto de design da skill `impeccable` (`/impeccable init`).

## Resumo do que foi feito

Criado o contexto de design estratégico do projeto para que comandos futuros da skill `impeccable` (critique, audit, polish, document, live, etc.) trabalhem alinhados à identidade e aos objetivos do app.

Fluxo seguido (`reference/init.md`): crawl do código → entrevista estratégica com o usuário → escrita do `PRODUCT.md` → configuração do modo `live`.

## Arquivos criados

- **`PRODUCT.md`** (raiz) — documento estratégico de design. Define:
  - `Register`: **product** (app UI; não há superfície de marketing/landing).
  - `Users`: estudantes de concurso público brasileiros, preparação de longo prazo, uso desktop + mobile (PWA/offline).
  - `Product Purpose`: app local-first PDCA para planejar/executar/medir/corrigir estudos; "nunca perder dados".
  - `Brand Personality`: **Foco & calma** (focado, calmo, confiável); identidade visual escura já comprometida (6 temas) a ser **preservada**.
  - `Anti-references`: **SaaS genérico** e **corporativo/estéril** (+ evitar infantil/gamificado e denso/poluído).
  - `Design Principles`: 5 princípios (calma sobre estímulo; dado herói/tarefa foco; confiança pela consistência; nunca perder o trabalho; identidade própria, não template).
  - `Accessibility & Inclusion`: alvo **WCAG AA** válido para os 6 temas; teclado, toque 44px, `prefers-reduced-motion`, pt-BR.
- **`.impeccable/live/config.json`** — config do modo live. `files: ["src/index.html"]`, `insertBefore: </body>`, `commentSyntax: html`, `cspChecked: true`.
- **`DESIGN.md`** (raiz) — sistema visual (gerado depois, via `/impeccable document` em scan mode). Formato Stitch: frontmatter normativo em hex (cores, tipografia, rounded, spacing, components) + 6 seções. North Star: **"A Sala de Instrumentos"**. Documenta paleta (accent `#8aa4bf`, 6 temas), tipografia (Plus Jakarta Sans + DM Mono), elevação (sombra difusa + rim-light), componentes (botões, cards, stat/event cards, inputs, nav, badges) e Do's/Don'ts (carregando as anti-refs do PRODUCT.md).
- **`.impeccable/design.json`** — sidecar do DESIGN.md (schemaVersion 2): colorMeta + tonal ramps, shadows, motion, breakpoints, 9 componentes `ds-*` self-contained (renderizados pelo painel do `live`), e narrative.

## Decisões técnicas relevantes

- **Identidade preservada, não recriada:** a varredura confirmou tokens comprometidos em `src/css/tokens.css` (accent steel-blue `#8aa4bf`, fundo `#08090d`, Plus Jakarta Sans + DM Mono) e 6 temas em `src/css/base/themes.css`. Por isso **não** foi gerada paleta nova (a regra "new projects only" da skill não se aplica aqui).
- **Register confirmado pelo usuário** como `product`.
- **CSP é `meta-tag`** (em `src/index.html`, linhas 14-25) — não é auto-patchável pela skill. Live mode exige edição manual (ver Pendências).
- `PRODUCT.md` escrito com cabeçalhos canônicos em inglês (compatibilidade com o parser da skill) e corpo em pt-BR.

## Testes executados

Nenhum — tarefa exclusivamente de documentação/configuração, sem alteração de código de produção ou de testes. Não houve mudança de comportamento do app.

## Status do GitHub

- Branch: `main`. Arquivos novos **não commitados** (aguardando decisão do usuário).
- Comandos sugeridos:
  ```bash
  git add PRODUCT.md DESIGN.md .impeccable/ docs/handoff-2026-06-24-impeccable-init.md
  git commit -m "docs(design): adicionar PRODUCT.md, DESIGN.md e config do impeccable"
  git push
  ```

## Pendências / Próximos passos

1. **DESIGN.md gerado** (✓ feito nesta sessão). Próximo passo natural de avaliação: `/impeccable audit src/css` (contraste/a11y nos 6 temas) ou `/impeccable critique <tela>` (review de UX pontuada — projeto nunca foi criticado).
2. **CSP bloqueia o live mode.** Para usar `/impeccable live`, adicionar manualmente `http://localhost:8400` às diretivas `script-src` **e** `connect-src` do meta CSP em `src/index.html`. (Idealmente só em ambiente de dev.)
3. **Achados de design a tratar** (levantados na varredura, candidatos a comandos):
   - `event-card` usa faixa lateral de cor de 4px (`event-stripe`) — é exatamente o anti-padrão "side-stripe border" que a skill rejeita. Candidato a `/impeccable polish` ou `quieter`.
   - Inconsistência de faixas: `stat-card` usa faixa no topo, `event-card` na lateral.
   - Sem estados vazios documentados → `/impeccable onboard` ou `harden`.
   - Sem estados de validação inline em formulários → `/impeccable harden`.
   - Verificar contraste WCAG AA nos 6 temas → `/impeccable audit src/css`.
4. **Opcional:** anexar um resumo de "Design Context" ao `CLAUDE.md` apontando para o `PRODUCT.md` (não feito; aguardando OK do usuário).

## Como retomar

O contexto está pronto. Qualquer comando `impeccable` lerá `PRODUCT.md` automaticamente. Sugestão de retomada: `/impeccable document` (gera DESIGN.md) e depois `/impeccable audit src/css` (contraste/a11y nos temas).
