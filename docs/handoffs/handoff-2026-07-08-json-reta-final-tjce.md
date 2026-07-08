# Handoff — 2026-07-08 — JSON de importação da Reta Final TJCE 2026

## Rodada 2 — ajuste com o backup real do usuário + fix de matching

Após a 1ª versão, o usuário enviou o print do preview (várias entradas "será criado")
e o backup real do app (`estudoorganizadobackup20260708.json`). Dois problemas:

1. **Nomes de disciplina divergentes do MD.** No app do usuário, as disciplinas do
   edital TJ-CE se chamam **"Legislação Específica"** (que reúne as aulas de
   "Legislação" E de "Noções Sobre Direitos das Pessoas com Deficiência" do catálogo,
   sem conflito de nomes) e **"Raciocínio Lógico"** (não "Raciocínio Lógico-Matemático").
   O JSON foi regerado com os nomes reais; nomes de aula já batiam verbatim.
2. **Bug real no matching: editais arquivados casavam primeiro.**
   `matchRetaFinalToEditais` (`src/js/logic/reta-final-core.js`) indexava TODOS os
   `state.editais` com "primeiro nome ganha". O backup tem PGE-RN e TCE-RN
   (`arquivado: true`) ANTES do TJ-CE — disciplinas homônimas (Direito Administrativo,
   Civil, Constitucional, Proc. Civil, Penal, Língua Portuguesa, Legislação Específica)
   casariam com os editais arquivados e as aulas novas seriam criadas no concurso errado.
   **Fix (TDD):** 2 testes novos em `tests/unit/reta-final-core.test.js` (red) →
   `matchRetaFinalToEditais` agora pula `edital.arquivado` (green). Disciplina que só
   existe em edital arquivado passa a ser criada no edital ativo (comportamento correto
   via `activateRetaFinal`, que já usava o primeiro edital não arquivado como alvo).
   Suíte completa: 2064 testes passando.

**Validação da rodada 2** (script no scratchpad, contra o backup real): payload válido;
9 disciplinas casadas com o edital TJ-CE (todas com `editalId` do TJ-CE), 2 criadas por
design (Prova Discursiva, Simulados); 4 aulas criadas (os 4 simulados, que não existem
no edital); 8 tópicos novos (4 redações, 3 revisões de simulado, 1 pegadinhas).

**Importante para o usuário:** o app dele precisa estar rodando o código com o fix
(deploy/atualização do PWA — o bump de cache é automático no commit) ANTES de importar,
senão o matching volta a casar com os editais arquivados.

---

## Rodada 1 (histórico)

## O que foi feito

Convertido o cronograma HTML do usuário (`cronograma_tjce_2026_page_aware.html`, 34 dias:
30 úteis de 29/06 a 07/08/2026 + 4 simulados aos sábados) em um payload JSON de importação
de "cronograma de reta final", usando o catálogo de aulas PDF do curso Gran (arquivo MD com
391 aulas em 14 disciplinas) como fonte dos nomes de aula.

**Deliverable:** `docs/cronogramas/reta-final-tjce-2026.json` — 34 dias, 86 blocos,
`dataFinal: 2026-08-09` (dia da prova), `minutosPadrao: 60`.

## Decisões (confirmadas com o usuário)

- **Nomes de aula verbatim do MD** (formato `"N - Título - X páginas [- PDF sintético]"`),
  porque é assim que as aulas estão cadastradas no app dele — garante casamento por nome
  em `matchRetaFinalToEditais` sem criar aulas duplicadas.
- **Datas originais mantidas** (29/06 em diante), mesmo com os dias 1–7 já passados; a
  rolagem da reta final empilha os atrasados em "hoje".
- Blocos do HTML com 2 aulas viraram 2 blocos JSON (o schema aceita 1 `aula` por bloco),
  com minutos divididos (120 → 60+60). Dias úteis somam 240 min; sábados de simulado, 210.
- Blocos de conteúdo usam **só `aula`** (sem `topicos`) para não criar assuntos à toa.
  Blocos sem aula usam `topicos`: 4 redações (Prova Discursiva), 3 revisões de erro de
  simulado e 1 "pegadinhas FCC" (ambos em Simulados) — esses 8 tópicos serão criados como
  assuntos novos na ativação, por design.
- Dia 28/07: o card do HTML cita "Lei 13.146/2015 + Resolução CSJT 386/2024"; incluí as
  duas aulas de PcD (aula 3 e aula 1) para cobrir o conteúdo citado.

## Verificação executada (script no scratchpad, não commitado)

- `validateRetaFinalPayload` (validador real do app, `src/js/logic/reta-final-core.js`): **valid**.
- 78 blocos com aula — todos os nomes existem **verbatim** no MD, na disciplina certa.
- Soma de minutos por dia conferida (240/210).
- `matchRetaFinalToEditais` contra edital sintético construído do MD: **0 disciplinas e
  0 aulas criadas**; exatamente os 8 tópicos novos esperados.

Nenhum código do app foi alterado (deliverable é artefato de dados) — por isso não há
testes novos; a validação acima cumpre o papel proporcional ao risco.

## Estado atual / o que falta

- Concluído. O usuário só precisa importar `docs/cronogramas/reta-final-tjce-2026.json`
  pelo fluxo "Importar reta final" do app e marcar como concluído o que já estudou nos
  dias 29/06–07/07 (esses blocos rolam para hoje).

## Avisos ao usuário (do próprio HTML)

- O curso **não tem aula de "Legislação Previdenciária do Estado do Ceará"** (tópico da
  Retificação 02/2026) — conteúdo precisa ser buscado à parte; não há bloco com aula para
  isso no JSON.
- Aulas 25/26/35 de Direito Administrativo (Lei 8.112, CLT) caíram do edital e não estão
  no cronograma.

## Próximos passos sugeridos (se necessário)

- Se o usuário quiser reancorar datas ou trocar nomes de tópicos, basta regerar o JSON —
  o mapeamento dia-a-dia está documentado no script de geração (scratchpad da sessão) e
  pode ser reconstruído a partir do HTML + MD anexados à conversa.
