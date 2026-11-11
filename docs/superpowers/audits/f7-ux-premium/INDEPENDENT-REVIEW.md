# Revisão independente — Redesign Premium

Revisores read-only: Bernoulli (integridade) e Lovelace (UX/acessibilidade/testes). Delta e160da5a..25b8ca0f. Nenhum P0. Correções em 4a6b2640 e f685425f.

## P1 encontrados e resolvidos

- Command Center usava aria-modal sem conter Tab e sem aria-activedescendant. Corrigido: Tab permanece no campo, opções têm IDs e o input anuncia a opção ativa; Escape é global.
- Modo Foco desmontava o botão focado e não tinha Escape. Corrigido: foco inicial no Sair, Escape global, retorno ao gatilho e status aria-live.
- Atalho Ctrl+K conflita com o navegador. O rótulo e aria-keyshortcuts passaram a anunciar Ctrl+Shift+K; o botão visível continua sendo a via principal.
- Countdown da prova usava UTC e podia cair um dia à noite. Corrigido para data civil em America/Fortaleza antes do cálculo.

## P2 corrigidos

- Duplo confirm() ao navegar com rascunho sujo: agora um único guard com skipGuard.
- Swatch da Platina era claro e não representava o tema escuro; corrigido.
- Botões do Foco ignoravam locked; agora desabilitam e exibem aviso de autoridade estrangeira.
- Cards sólidos não removiam sombra; glow/cards têm precedência definida.
- Rótulo longo no Foco recebeu quebra de linha.

## P2 mantidos

- CSS possui regras duplicadas antigas de .app-header/.theme-picker.
- VA-03 não foi exercitado com sessão ativa durante troca de tema.
- VA-19 não exercitou conflito real em tela pequena.
- Bottom sheets dedicados de DV-17 não foram introduzidos.
- NVDA/Narrator e hardware modesto NOT_RUN.

