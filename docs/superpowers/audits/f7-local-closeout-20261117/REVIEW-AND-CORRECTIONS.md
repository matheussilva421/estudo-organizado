# Revisão e correções

## Achados corrigidos nesta rodada

| Achado | Severidade | Correção | Evidência |
|---|---|---|---|
| Entidade legada sem `meta/head` podia atualizar para revisão 2 e iniciar uma cadeia na sequência 1; `head=0` contornava o primeiro check | P1 de integridade | update exige head causal em sequência 1+; create inicial exige sequência 1 com change | RED/GREEN no Emulator; 37/37 |
| R3 provava um único tipo conhecido e comparava a allowlist por texto | P2 de cobertura | teste sequencial cria os 17 tipos em transações válidas | `r3_all_known_entity_types_are_accepted_in_sequence` |
| T19/T21 tinham apenas unitários, apesar de o plano prever E2E | P2 de evidência | `f7-restore.spec.ts` e `f7-backup.spec.ts` adicionados | 2/2 PASS focados |
| DV-13/VA-13 eram chamados de PASS sem testar “Explorar recorte” | P2 documental/UX | teste E2E de drill por edital/disciplina | 1 PASS focado + captura atual |
| Captura de Analytics sem dados não provava drill | P2 de evidência | fixture sintética de sessão e captura full-page populada | `F7-UX-CAPTURES/modules/analytics-drill-edital-desktop.png` |
| Matrices DV/VA divergiam entre FULL, DELTA, UXH e checklist | P2 documental | matriz atual consolidada; referências corrigidas | `MATRIZ-UX-DV-VA.md` |
| Typo `+## F0` quebrava o título da matriz de remediação | P3 documental | corrigido | arquivo de matriz UXH |

## Testes novos

- `apps/v2/tests/e2e/f7-backup.spec.ts`
- `apps/v2/tests/e2e/f7-restore.spec.ts`
- drill em `apps/v2/tests/e2e/f7-ux-attention-analytics.spec.ts`
- fixtures compartilhadas em `apps/v2/tests/e2e/f7-ux-helpers.ts`
- capturas de drill e sheet em `apps/v2/tests/e2e/f7-ux-evidence.spec.ts`
- dois casos Firebase em `apps/v2/tests/firebase/f7-security-residuals.test.ts`

## Diff funcional

- `apps/v2/firebase/firestore.rules`: `entityHasCausalAudit` recebe `requireExistingHead`; create passa `false`, update passa `true`.
- Nenhuma alteração no domínio acadêmico, IndexedDB, UI de produção, PWA, credenciais ou serviços externos.
- Os três PNGs F4 continuam fora dos commits e foram preservados externamente.

## Revisão independente

Uma revisão independente read-only do diff foi executada por agente separado, com foco em segurança, perda de dados, Rules, orçamento de 19/20 acessos, flakiness e falso PASS.

- **P0:** nenhum.
- **P1 corrigido:** o primeiro `headExists` podia ser contornado criando `head=0`. Agora o head inicial exige sequência 1 e um change correspondente; update exige sequência pelo menos 2. O teste `r1_denies_empty_head_that_could_seed_a_legacy_chain` fecha o caminho.
- **P1 corrigido na entrega:** o commit local passa a conter Rules, testes, matrizes e capturas, eliminando a alegação de fechamento apenas no working tree.
- **P2 corrigido:** o drill agora tem dois editais e duas disciplinas, com percentuais 75/25 e asserção de filtragem.
- **P2 corrigido:** a fixture de sessão passou a usar `origin: 'TIMER'` com intervalos, estado válido no domínio.
- **P2 corrigido:** o E2E de restore salva e valida a cópia pré-restore e confere subjects, editais, vínculos e assuntos após o commit.
- **P2 corrigido:** a allowlist passou a afirmar exatamente 17 tipos e manter o teste de tipo desconhecido.
- **P2 documentado:** uma entidade remota legada sem head permanece fail-closed e pode exigir rebaseline; não há caminho automático de recuperação para essa condição. Não há dado local perdido.
- **P3 corrigido:** a captura de drill espera e afirma o resultado antes do screenshot; o título do backup E2E foi reduzido para o escopo realmente provado.
- **Orçamento:** a nova condição reutiliza `headExists`/`sequence`; nenhuma leitura documental adicional foi introduzida. A margem continua 19/20 e sem contador interno automatizado.

## Rollback

Em clone descartável, reverter os arquivos/testes desta rodada e reaplicar o estado anterior ao commit documental. Não usar reset/clean/force no checkout real. O bundle inicial contém `v2`, `main`, `origin/v2`, refs recovery e snapshots necessários.
