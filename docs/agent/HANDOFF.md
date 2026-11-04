# F6 — checkpoint de fechamento técnico pré-aceite

**Atualizado:** 2026-11-04
**Worktree:** `C:\Users\slvma\.codex\worktrees\v2-f4\estudo-organizado`
**Branch:** `v2` (local, ahead de `origin/v2`; sem push)
**Último commit de código:** `994d5cd` (o commit documental deste checkpoint é o commit que contém este arquivo)

## Objetivo e escopo

Fechar tecnicamente a F6 antes do aceite humano: corrigir lacunas materiais, reconciliar
documentação e evidências, executar testes locais, revisões independentes e entregar um
ZIP verificável. Sem push de código, merge, deploy, PR, Actions ou alteração da `main`.

## Concluído

- AC18, AC20, AC29 e AC34 saíram de `NOT_RUN` para `PASS` com evidência real.
- Rascunhos por documento (não por sessionStorage), com detecção de revisão-base,
  resolução explícita e falha de quota visível nos formulários principais.
- Concorrência entre abas: CAS com um vencedor, broadcast e formulário obsoleto bloqueado.
- INCOMING parcial real (`OPEN` + `resolution: INCOMING`) rebaixa projeções para `PARTIAL`.
- Prioridades da Home separam diagnóstico remoto da ação acadêmica.
- Analytics com série por dia e distribuição por estado não aditiva.
- 320 px e 640×450 sem overflow; reduced motion com transição real.
- Duas revisões independentes read-only: P1 corrigidos; P2/P3 documentados.
- Pacote `F6-REVIEW-PACKAGE-FINAL.zip` validado por extração e manifesto.

## Pendente

- Aceite humano H-01–H-17; H-02 (NVDA/Narrator) e H-16 (hardware modesto) `NOT_RUN`.
- AC24 `DEFERRED_F7` (UI de troca de perfil não existe na F6).
- RF parciais: RF04, RF06, RF13, RF15, RF25, RF30, RF31 e RF32.
- Integração de `v2` à `origin/v2`: exige autorização explícita, fast-forward e read-back.
- F7/F8 não iniciadas.

## Estado Git

- `main` e `origin/main`: `9046cfa` (intactas).
- `origin/v2`: `789e1bc`.
- `v2`: 20 commits de código F6 + 2 commits documentais/corretivos, sem push.
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

- Unitários: 572 PASS em 85 arquivos (40,08 s).
- E2E: 150 PASS + 2 skips (~60 s).
- Build: principal 388,75 kB (100,58 kB gzip) + vendor React 218,77 kB (68,25 kB gzip).
- Runtime: carga 326 ms, rota 38 ms, árvore de 1.000 assuntos em 54 ms.
- Pacote: `C:\Users\slvma\Downloads\Github\estudo-organizado-preservacao-20261103\F6-REVIEW-PACKAGE-FINAL.zip`.

## Decisões e riscos

- Rascunho é não autoritativo e não substitui CAS do IndexedDB.
- Contagem de INCOMING parcial pode persistir após reconciliação manual posterior (P2).
- `refreshSeq` existe, mas não há teste de corrida artificial (P2).
- `window.confirm` permanece no guard de navegação (P2).
- Quatro HIGH F0 seguem `UNVERIFIED`; F4-T13 e hardware modesto real seguem `NOT_RUN`.

## Próxima ação

Aceite humano do pacote. Se aprovado, autorizar a integração fast-forward de `v2` à
`origin/v2` com read-back, sem tocar `main`, Cloudflare, Firebase ou produção.
