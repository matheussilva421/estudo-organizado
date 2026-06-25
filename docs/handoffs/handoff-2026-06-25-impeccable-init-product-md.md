# Handoff — Impeccable init: refazer PRODUCT.md (2026-06-25)

## Resumo do que foi feito

Recriação da **PRODUCT.md** via `/impeccable init`, após ela e a DESIGN.md terem sido
removidas no commit `7764391` ("para refazer"). Conduzida **entrevista do zero** (escolha
explícita do usuário), em 2 rodadas, em vez de restaurar a versão antiga do git.

### Decisão estratégica principal (a razão do "refazer")

A **personalidade de marca mudou**:

- Antes (versão removida): *"Foco & calma — focado, calmo, confiável"* / princípio "calma sobre estímulo, densidade controlada".
- Agora (nova entrevista): **"Preciso, técnico, denso"** — painel profissional/instrumento de medição.
  Densidade passou de "defeito a controlar" para **recurso desejado**, desde que com hierarquia
  (densidade ≠ poluição; alvo = sinal alto).

Demais respostas da entrevista:
- **Register:** product (confirmado).
- **Usuário:** concurseiro long-term (concurso público BR, prep de meses/anos, desktop + PWA mobile/offline).
- **Sucesso (multi):** saber o próximo passo + progresso tangível + nunca perder dados + constância.
- **Anti-references:** SaaS genérico + corporativo/estéril (densidade/poluição mantida como ressalva, não como anti-ref total).
- **Acessibilidade:** WCAG AA em **todos os 6 temas** (Grafite, Ardósia, Platina, Terminal, Neon, Arrakis); teclado/foco, reduced-motion e toque 44px mantidos como práticas já presentes no código.

Identidade visual escura comprometida (6 temas, accent steel-blue, Plus Jakarta Sans + DM Mono)
foi **reafirmada como a preservar** — agora reenquadrada em torno de precisão/densidade, não de calma.

## Arquivos criados / alterados

- **Criado:** `PRODUCT.md` (raiz) — nova versão refletindo "preciso, técnico, denso".
- **Criado:** este handoff.
- Não alterados: `.impeccable/live/config.json` (live mode já configurado — Step 6 do init é no-op),
  `.impeccable/design.json` (intocado).

## Atualização — DESIGN.md refeita (mesma sessão)

`/impeccable document` rodado em seguida (scan mode). Decisões:
- **North Star mantida:** "A Sala de Instrumentos" — passou a casar melhor com a nova personalidade.
- **Densidade = recurso declarado** (não "o lugar mais calmo"): prosa reescrita; nova named rule
  "A Regra da Densidade com Sinal".
- Tokens reais extraídos de `src/css/tokens.css` (hex, Stitch-compliant); 6 seções Stitch.

Arquivos:
- **Criado:** `DESIGN.md` (raiz).
- **Regenerado:** `.impeccable/design.json` (narrativa alinhada; tokens/componentes `ds-*` inalterados).
- Memória `project_impeccable_design_context` atualizada.

## Pendências / próximos passos

1. Validar a nova direção "densa/precisa" nas telas-painel: `/impeccable critique "Página Inicial"`
   ou `/impeccable critique Dashboard` (projeto nunca teve critique registrado).
2. Se quiser empurrar a precisão tipográfica/tabular dos números: `/impeccable typeset` ou `/impeccable layout`.
3. Live mode já configurado; lembrar da pegadinha do CSP `meta-tag` (`http://localhost:8400` em
   `script-src` e `connect-src` de `src/index.html`) antes de rodar `/impeccable live`.

## Testes

Nenhum teste de código executado — tarefa de documentação/contexto, sem alteração de código-fonte.
Validação: `JSON.parse` do sidecar OK; frontmatter da DESIGN.md presente.

## Status do GitHub

Pendente. Branch atual: `main`. Comandos sugeridos:

```bash
git add PRODUCT.md DESIGN.md .impeccable/design.json docs/handoffs/handoff-2026-06-25-impeccable-init-product-md.md
git commit -m "docs(design): refazer PRODUCT.md e DESIGN.md (personalidade 'preciso, tecnico, denso')"
git push
```
