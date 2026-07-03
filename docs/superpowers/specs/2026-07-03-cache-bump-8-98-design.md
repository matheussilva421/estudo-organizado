# Bump de cache 8.98

## Objetivo

Invalidar os assets estáticos atualmente identificados como versão `8.97`,
publicando a versão `8.98` sem alterar comportamento funcional.

## Alterações

- Atualizar para `8.98` as query strings de assets em `src/index.html`.
- Atualizar `APP_VERSION` para `8.98` em `src/sw.js`.
- Atualizar `DIAGNOSTIC_BUILD_VERSION` para `8.98` em
  `src/js/sync/sync-diagnostic.js`.
- Atualizar o teste de arquitetura para exigir a versão `8.98`.
- Não alterar os specifiers de módulos ES que permanecem em `8.37`.

## Validação

Seguir TDD: primeiro alterar a expectativa específica e confirmar que ela falha
contra a versão `8.97`; depois aplicar o bump mínimo e confirmar que o teste
passa. Como o fluxo afeta PWA/cache, executar também a suíte unitária completa
antes da publicação.

## Publicação

Commitar somente os arquivos desta alteração, preservando o trabalho já presente
no diretório, e enviar o commit para o branch remoto atual.
