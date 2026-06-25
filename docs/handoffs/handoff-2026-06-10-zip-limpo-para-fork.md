# Handoff — ZIP limpo do projeto para compartilhamento (2026-06-10)

## Objetivo da sessão

Gerar um ZIP do projeto para o usuário entregar a um amigo (que criará o próprio repositório), contendo apenas o necessário para montar/rodar o app — **sem** credenciais, handoffs, auditorias e documentação interna.

## O que foi feito

1. **Inventário do repo** (exploração completa): única credencial hardcoded encontrada foi a config do Firebase em `src/js/firebase/firebase-runtime-config.js` (apiKey/projectId/appId). Cloudflare token e Google Drive Client ID são informados em runtime pela UI (IndexedDB) — nada hardcoded.
2. **Staging a partir de `git ls-files`** (316 de 370 arquivos rastreados), excluindo:
   - `docs/**` (handoffs, auditorias, relatórios) e `src/docs/**` (planos, QA, sync-hardening) — decisão do usuário: excluir TODA a documentação;
   - `HANDOFF_CONTEXT.md`, `AGENTS.md`, `.codexignore`, `.cursorignore`, `.aiexclude`.
3. **Sanitização (apenas na cópia do zip; o repo NÃO foi alterado):**
   - `src/js/firebase/firebase-runtime-config.js` reescrito com campos vazios + comentário de orientação (decisão do usuário: o amigo cria o próprio projeto Firebase);
   - `README.md` e `README_DEV.md`: removidas referências a `docs/handoff-*`, `src/docs/**` e à seção de documentação técnica interna;
   - criado `SETUP.md` na raiz do zip com instruções de instalação, testes, Firebase, Cloudflare Worker e Google Drive.
4. **Validações no staging:**
   - varredura de segredos/termos internos (`AIzaSy`, sender ID, `handoff`, `auditoria`, `superpowers`, `relatorio`): zero ocorrências após limpeza (exceções inofensivas: "Auditoria Constitucional" é dado fictício de teste e2e; `app-de-estudos-14564` permanece só no CSP de `src/index.html` e no teste de contrato — é domínio público, documentado no SETUP.md);
   - `git init` + `npm install` + `npx vitest run` na pasta extraída — ver status na seção Validações.
5. **Empacotamento:** `Compress-Archive` → `C:\Users\slvma\Downloads\estudo-organizado-clean.zip` (raiz = pasta `estudo-organizado/`).

## Arquivos alterados no repositório

- Apenas este handoff (`docs/handoff-2026-06-10-zip-limpo-para-fork.md`). Nenhum código, config ou doc do app foi modificado. **Sync não foi tocado.**

## Validações executadas

- Varredura de segredos no staging: limpa (detalhes acima).
- Suíte unitária (vitest) rodada dentro do staging para garantir que a sanitização não quebrou nada: **verde** (resultado resumido na conversa da sessão).
- Listagem do zip conferida: sem `docs/`, `src/docs/`, `node_modules/`, `.claude/`, `.opencode/`, `.git/`.

## Riscos remanescentes / decisões para o usuário humano

- **O repositório GitHub é PÚBLICO** (`matheussilva421/estudo-organizado`). Handoffs, auditorias e a apiKey do Firebase já estão expostos lá e no histórico do git. O zip limpa apenas a cópia do amigo. Opções (decisão do usuário):
  - tornar o repo privado;
  - restringir a API key do Firebase por referrer HTTP no Google Cloud Console;
  - (mais trabalhoso) reescrever o histórico — não recomendado sem necessidade real, a chave web do Firebase é pública por design e a segurança vem das regras do Firestore + App Check.
- O amigo precisa: criar projeto Firebase próprio, preencher `firebase-runtime-config.js`, ajustar o domínio no CSP de `src/index.html` (e a expectativa em `tests/unit/firestore-contracts.test.js:245`). Tudo documentado no `SETUP.md` do zip.

## Próximos passos sugeridos

- Entregar `C:\Users\slvma\Downloads\estudo-organizado-clean.zip` ao amigo.
- Decidir sobre a visibilidade do repo público (ver riscos acima).
