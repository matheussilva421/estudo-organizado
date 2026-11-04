# F6 — checkpoint de conformidade da navegação

**Atualizado:** 2026-11-04
**Worktree:** `C:\Users\slvma\.codex\worktrees\v2-f4\estudo-organizado`
**Branch:** `v2` (local, à frente de `origin/v2`; sem push)
**Último commit de código:** `ff75484` (o commit documental deste checkpoint é o que contém este arquivo)

## Objetivo e escopo

Fechar a divergência de navegação desktop/tablet da D-F6-01 B, reconciliar RF28/RF32,
delimitar AC24, executar testes direcionados e atualizar o pacote final. Sem push,
merge, deploy ou aceite humano.

## Concluído

- Navegação adaptativa: sidebar lateral no desktop (≥1024 px), rail compacto no tablet
  (721–1023 px) e barra inferior em duas linhas no mobile (≤720 px).
- Labels completos visíveis no rail e no mobile, com nomes acessíveis iguais ao texto
  visível (Label in Name); navegação movida para antes de `main`, alinhando DOM e foco.
- Rail com rolagem interna em alturas curtas; mobile sem overflow interno e com todos
  os nove destinos visíveis em 390 px e 320 px.
- Foco e rota preservados ao alternar 1280 → 768 → 390 → 1280.
- RF28 permanece `PARTIAL` (tema/densidade; preferências acadêmicas não contratadas).
- RF32 permanece `IMPLEMENTED_TESTED`; o relatório foi corrigido.
- AC24 `DEFERRED_F7`: isolamento local por `profileId` verificado; troca de identidade
  não homologada.
- Testes: typecheck/lint PASS; 572 unitários PASS; 156 E2E PASS + 2 skips;
  build principal 388,77 kB (100,59 kB gzip) + vendor 218,77 kB.
- Pacote final regenerado e verificado por extração + manifesto.

## Pendente

- Aceite humano H-01–H-17; H-02 (NVDA/Narrator) e H-16 (hardware modesto) `NOT_RUN`.
- AC24 `DEFERRED_F7`; RF04, RF06, RF13, RF15, RF25, RF28, RF30 e RF31 parciais.
- Integração de `v2` à `origin/v2`: exige autorização explícita, fast-forward e read-back.
- F7/F8 não iniciadas.

## Estado Git

- `main` e `origin/main`: `9046cfa` (intactas).
- `origin/v2`: `789e1bc`.
- `v2`: 25 commits à frente, sem push de código.
- Worktree: apenas os três PNGs F4 modificados, preservados fora dos commits.
- Branch `codex/f5-local-preserved-20261102`: 4 commits exclusivos preservados; não é ancestral da v2.

## Testes e evidências

```powershell
cd apps/v2
npm run typecheck
npm run lint
npm run test:unit
npx playwright test --grep-invert "f4 representative visual evidence"
npm run build
```

- Unitários: 572 PASS em 85 arquivos (37,26 s).
- E2E: 156 PASS + 2 skips (~78 s).
- Build: principal 388,77 kB (100,59 kB gzip) + vendor React 218,77 kB (68,25 kB gzip).
- Runtime: carga 275 ms, rota 52 ms, árvore de 1.000 assuntos em 38 ms.
- Pacote: `C:\Users\slvma\Downloads\Github\estudo-organizado-preservacao-20261103\F6-REVIEW-PACKAGE-FINAL.zip`.

## Decisões e riscos

- Revisão independente apontou três P1 (Label in Name, ordem DOM/foco e overflow mobile);
  todos foram corrigidos e cobertos por testes de geometria, nome acessível e foco.
- Breakpoints continuam por viewport, não por contêiner (RF06 parcial).
- Contraste da navegação: ativo 14,09:1; inativo 10,37:1; mínimo global 6,78:1.
- Quatro HIGH F0 seguem `UNVERIFIED`; F4-T13 e hardware modesto real seguem `NOT_RUN`.

## Próxima ação

Aceite humano do pacote. Se aprovado, autorizar a integração fast-forward de `v2` à
`origin/v2` com read-back, sem tocar `main`, Cloudflare, Firebase ou produção.
