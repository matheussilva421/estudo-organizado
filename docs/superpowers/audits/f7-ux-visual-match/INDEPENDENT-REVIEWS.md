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

## Revisão independente da rodada v13

**Escopo:** comparação dos quatro mockups originais com as capturas v13, leitura do CSS/JSX e do teste de geometria. Revisor read-only, sem alteração de arquivos.

**Veredito:** no desktop 1586x992, o espaçamento macro corresponde substancialmente ao mock. Rail, origem do conteúdo, hero, faixa de passos, Bento e recursos não parecem mais o dashboard antigo. A malha externa é aderente; o acabamento interno permanece mais compacto que o mock. Nenhum P0 encontrado.

### Achados e tratamento

- **P1 — overflow da faixa de passos entre 1400 e 1585 px.** Confirmado por CSS e reproduzido em teste: com viewport de 1440 px, o scrollWidth chegou a 1585 px. O breakpoint de nowrap passou de 1400 para 1586 px, com teste dedicado em 1440 px. **Resolvido.**
- **P1 — escala editorial interna do hero.** O título medido no CSS é 32 px e, na comparação 1:1, acompanha a altura visual do mock. Corpo de 14,4 px e CTAs de 48 px ainda diferem da estimativa do revisor (corpo ~16–18 px, botões ~40–46 px). A caixa externa e a posição estão corretas; a diferença restante é de acabamento tipográfico. **PARTIAL.**
- **P1 — composição do card “Meta diária”.** O valor de duração fica ao lado do anel, não dentro dele, e o anel desktop mede 96 px contra aproximadamente 112 px no mock. Isso é composição do estado vazio, não erro de espaçamento. **PARTIAL/DEFERRED.**
- **P2 — ícones dos recursos.** O card externo tem 95 px, mas o ícone permanece em 40 px; o mock sugere algo maior. **PARTIAL.**
- **P2 — detalhes internos do rail.** Ícone e rótulo ficam alguns pixels à esquerda do mock, e a citação do rodapé fica mais baixa por usar margin-top:auto. Estrutura e alinhamento externo estão corretos. **PARTIAL.**
- **Rastreabilidade das capturas.** O revisor não conseguiu ligar os PNGs ao HEAD antigo. As capturas foram regeradas depois do commit 08700060 e agora têm EVIDENCE-MANIFEST.json com codeHead e viewports, além de SHA256SUMS. **Resolvido.**

### Limites da revisão

O revisor não reexecutou typecheck, unitários ou E2E e não examinou estados hover/foco/movimento. Tablet e mobile não têm mockups equivalentes; 320/390 foram validados por testes, não por equivalência visual. A leitura do botão secundário no limite da barra móvel ficou inconclusiva. NVDA/Narrator, hardware e toque físico continuam NOT_RUN.
