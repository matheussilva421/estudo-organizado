# Pareceres independentes e reparos

## Revisão funcional

Veredito: sem P0; delta de apresentação preservou domínio, IndexedDB, outbox e clock. Achados e tratamento:

- P1 Participação do Insights somava editais e disciplinas no mesmo denominador: corrigido para denominador por dimensão; texto passou a dizer “tempo da mesma dimensão”.
- P1 “Últimos 7 dias” usava sete dias com dados: corrigido para janela de sete dias civis encerrada hoje.
- P1 Home escondia falha de backup: alerta crítico da Home agora inclui backup FAILED, e o detalhe de sincronização abre automaticamente nesse estado.
- P1 link crítico com role=status: role removido; permanece link navegável.
- P2 rail-brand sem estilo em 721–1023: oculto nessa faixa.
- P2 Planning misturava escopos: “Blocos do cenário” agora conta o cenário selecionado, como minutos e sem data.
- P2 revisões futuras não apareciam: cartão inclui ATIVIDADE_FUTURA com destino Revisões.
- P2 gráfico semanal sem série acessível: role=img com valores diários em minutos.
- P2 histórico visual truncava em 12: agora avisa quantos itens existem e onde ver o restante.

Não reexecutado pelo revisor: unit/E2E, IndexedDB real, NVDA, 200% e tablet. A validação do implementador cobre esses pontos na suíte.

## Revisão visual

Veredito inicial: a Home ainda parecia dashboard antigo com hero premium; divergências principais em rail de 294 px, hero começando em x≈335, tipografia 40 px, CTAs 48 px, Bento 1/1,08/1,25 e topbar com busca em x≈957.

Reparos executados:

- Rail de 295 px, padding 24, logo 44, linhas 52, ícones 24, item ativo em pílula iluminada.
- Conteúdo iniciando em x≈351; hero de 270 px com título 40–41 px e CTAs de 48 px com seta.
- Bento 1/1,08/1,25, anel 110 px e moldura de gráfico mesmo no vazio.
- Busca limitada a 415 px à direita; tema compacto, Comandos como ícone e avatar.
- Passos com frase introdutória, quatro cápsulas de 36 px, setas e uma única linha.
- Recursos com tile de 40 px à esquerda e texto alinhado.
- Sidebar em plano cromático distinto, com brilho ambiente e cards mais claros.

Permanecem PARTIAL: altura/conteúdo dos cartões Bento e profundidade fotográfica. Módulos ainda usam a mesma linguagem de painéis com subnavegação; não são pixel-equivalentes a mockups inexistentes.

## Limites

Os pareceres foram read-only. A suíte completa posterior passou; NVDA/Narrator, hardware e toque físico continuam NOT_RUN. O aceite visual final pertence ao proprietário.
