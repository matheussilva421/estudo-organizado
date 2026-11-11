# PUBLISH-HANDOFF — plano apenas, não executado

Status: **ORIGIN_V2_UNPUBLISHED**. Nenhum push foi feito.

## Pré-condições (todas obrigatórias)

1. UX-H com decisão ACEITO ou ACEITO COM RESSALVAS tratadas.
2. Autorização específica e posterior para publicar origin/v2.
3. Preflight novo: árvore limpa, HEAD esperado, origin/v2 inalterado, merge-base ancestral.
4. Backup/bundle do HEAD publicado.

## Comando futuro (somente após autorização)

    cd C:/Projetos/estudo-organizado/_v2-candidate
    git fetch origin
    git status --short --branch
    git rev-parse v2 origin/v2
    git merge-base --is-ancestor origin/v2 v2
    git push origin v2:refs/heads/v2
    git fetch origin
    git rev-parse origin/v2

O push deve ser fast-forward. Nunca usar --force. Se origin/v2 avançou, parar e reconciliar sem descartar trabalho.

## Verificação pós-push (futura)

- Comparar origin/v2 com o HEAD local.
- Confirmar no GitHub o commit e ausência de force.
- Não fazer merge em main, deploy ou staging.

## Gates seguintes, independentes

| Etapa | Dependência |
|---|---|
| Push origin/v2 | autorização específica |
| G-EXT | autorização própria; Firestore Rules/consentimento/migração tratados |
| G-STAGING | autorização própria e deploy separado |
| Homologação F7/V2 | ambiente real e conta QA |
| F8 | autorização autônoma posterior |

Cada etapa é independente; aprovar uma não aprova as demais.

