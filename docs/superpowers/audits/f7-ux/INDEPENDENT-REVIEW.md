# Revisão independente F7-UX

**Data:** 10/11/2026

**Modo:** somente leitura, revisão de código e testes; nenhuma alteração do revisor.

**Veredito final do terceiro revisor:** **SEM BLOQUEADOR MATERIAL** (nenhum P0/P1).

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
