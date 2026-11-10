# Revisão independente F7-UX

**Data:** 10/11/2026

**Modo:** somente leitura, revisão de código e testes; nenhuma alteração do revisor.

**Veredito final do terceiro revisor:** **SEM BLOQUEADOR MATERIAL** (nenhum P0/P1).

> Nota: esse veredito vale para o HEAD 0d2ee339. A rodada seguinte (seção ao final deste arquivo) revisou 0d2ee339..906ef7c6, encontrou dois P1 e os corrigiu; o parecer anterior não cobre o delta novo.

## Rodadas

1. A primeira revisão não encontrou P0, mas apontou riscos de restore, concorrência de Conteúdo, filtros e indicadores. Foram corrigidos: semântica de bloco cumprido, cache causal, evidência local/ACK/backup e ausência de `eval`.
2. A segunda revisão ainda encontrou P1 em `REBASELINE_REQUIRED`, ausência de cópia/read-back, epoch F1/F2 fixa, CAS na movimentação, filtros sem efeito, escala de amostra e persistência do snapshot. Todos receberam correção e testes focados.
3. A revisão final confirmou **SEM BLOQUEADOR MATERIAL**, após o bloqueio efetivo de rebaseline, detecção de base stale, cópia pré-restore, read-back transacional, classificação F1/F2 pela época real, filtros por escopo, zero ausente, snapshot persistido e validação do foco filho.

## Riscos P2 residuais

- O download da cópia pré-restore depende do navegador; a operação não declara que o arquivo externo foi salvo. O snapshot pré-restore é emitido antes do commit, mas a confirmação do download pelo usuário não é automatizável.
- Widgets personalizados permanecem preferência local em `localStorage`, não entram no backup F7 e não recalculam um recorte de domínio.
- Leitura física de época/tombstones agora falha fechada; indisponibilidade de Chrome/Safari específico e crash real continuam sem ensaio.
- Preferências e relatórios históricos fora do backup estão explicitados na UI.

## Evidência de independência

Os revisores trabalharam somente em leitura, em sessões separadas, sem editar arquivos ou executar push. Os pareceres foram comparados com o código e os testes atuais; nenhum relatório foi aceito como prova por si só.
# Revisão independente — rodada 2026-11-10

Dois revisores read-only, sem participação na implementação, examinaram 0d2ee339..906ef7c6. Nenhum arquivo foi editado por eles.

## Revisor A — integridade F3/F4/F5

Achados P1 corrigidos:

- CORRECT_MANUALLY a partir de sessão PAUSED tentava transicionar PAUSED→PAUSED e falhava. Correção: quando o estado já é PAUSED, a correção usa EDIT_FACTS; teste novo cobre pausa com lacuna seguida de correção.
- applyPlacement lia a revisão do cenário no momento do apply, então uma prévia vencida sempre passava no CAS. Correção: a prévia carrega scenarioRevision; o apply revalida sobreposição/capacidade com previewPlacement atual, exige cenário ainda ACTIVE e a mesma revisão, e grava o bloco recalculado. Teste novo ocupa o horário após a prévia e exige CONFLICT OVERLAP sem bloco extra.

Achados P2 corrigidos:

- checkpoint válido apagava recoveryFlag criado por flagInactiveSession; a transição agora preserva a flag até correção explícita.
- manifesto de checkpoint existente era reescrito com dados atuais; agora o manifesto do snapshot é preservado e só recebe activationOf/deactivated.

P2 documentado: se a ativação falhar após criar o checkpoint, resta um checkpoint MANUAL órfão; não há perda de dados e a restauração continua íntegra.

## Revisor B — experiência, acessibilidade e rastreabilidade

Achado P1 corrigido:

- A primeira correção da Home usava CSS order; a ordem visual ficava correta, mas o teclado e o leitor de tela seguiam controles → widgets. O CSS order foi removido e os blocos foram movidos no JSX; o E2E agora mede a ordem DOM e a posição vertical, exigindo grade antes de contagem e controles.

P2 documentados, não bloqueadores:

- Confirmar ativação não checa busy/locked; duplo clique pode gerar um segundo CONFLICT após o sucesso.
- Prévia de ativação não usa aria-expanded/aria-controls e o foco não retorna ao gatilho após confirmar/cancelar.
- Lista do calendário usa enums crus e datas ISO; a mensagem vazia fala do cenário selecionado, mas a consulta inclui cenários oficiais.
- Filtro de revisão sem resultado mostra “Nenhum compromisso confirmado”; a contagem não tem aria-live.

Nenhum P0 foi encontrado. O HEAD final de código após as correções é 8f2fee85; o commit 8f2fee85 ajusta o default da fila para “Todas” (preserva itens concluídos visíveis) e torna os testes de origem/SW portáveis pela variável PLAYWRIGHT_PORT.
