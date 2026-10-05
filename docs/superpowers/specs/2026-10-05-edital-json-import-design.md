# Importação de edital via JSON — design aprovado

**Data:** 2026-10-05  
**Issue:** #100 — `[Feature] Importar edital via JSON com preview e matching seguro`  
**Status:** aprovado pelo usuário durante brainstorming com Superpowers  
**Escopo:** design arquitetural; nenhuma implementação de produção faz parte deste commit

## 1. Objetivo

Adicionar ao **Estudo Organizado** um fluxo especializado para importar editais estruturados em JSON, com preview humano, matching determinístico, merge aditivo e preservação total do progresso existente.

O fluxo deve ser compatível com os arquivos `02-edital-*.json` gerados pela Central de Concursos Portable, mas não deve depender do formato de backup integral do aplicativo.

Fluxo esperado:

```text
arquivo JSON
    ↓
parse
    ↓
validação
    ↓
identidade/proveniência
    ↓
seleção do destino
    ↓
matching
    ↓
import plan imutável
    ↓
preview humano
    ↓
confirmação
    ↓
apply atômico
    ↓
persistência + render
```

Princípio central:

> Importar pode acrescentar estrutura; nunca pode inferir autorização para destruir, resetar ou sobrescrever progresso.

## 2. Contexto do código atual

O projeto já possui um fluxo semelhante para **Reta Final**, principalmente em:

- `src/js/views/reta-final-import.js`
- `src/js/logic/reta-final-core.js`
- `src/js/logic/reta-final.js`
- `src/js/ui/actions/reta-final.js`
- `tests/unit/reta-final-core.test.js`
- `tests/e2e/reta-final.spec.js`

Esses arquivos são referência de arquitetura e UX, mas **não devem ser reutilizados diretamente para o matching do edital**.

O matcher atual da Reta Final seleciona a primeira ocorrência de uma disciplina por nome normalizado. Isso é incompatível com esta feature, pois a política aprovada para ambiguidades é conservadora: quando há mais de uma correspondência possível, nenhuma entidade existente é escolhida silenciosamente.

O aplicativo também mantém o invariante de **um único edital principal**. Criar um edital pela UI atual normalmente torna o novo edital principal e arquiva o anterior. A importação precisa respeitar esse invariante sem transformar a #100 em uma reformulação do modelo de editais.

## 3. Decisões de produto aprovadas

### 3.1 Editais arquivados

Editais arquivados ficam fora do matching de destino.

Se houver um edital arquivado com o mesmo nome normalizado do JSON:

- ele não é reutilizado;
- ele não é alterado;
- ele não é reativado automaticamente;
- o importador não oferece esse edital como alvo de merge.

A proveniência pode reconhecer que um arquivo se relaciona a uma importação antiga arquivada e exibir essa informação no preview, mas isso é apenas informativo. Para mesclar em um edital arquivado, o usuário deve primeiro torná-lo principal/ativo pelo fluxo normal do aplicativo.

### 3.2 Edital ativo com mesmo nome

Quando existir um edital ativo com o mesmo nome normalizado do JSON, o importador não decide silenciosamente.

O preview oferece:

- **Mesclar com o edital existente**; ou
- **Criar um novo edital separado**.

### 3.3 Criação e edital principal

Quando o usuário escolher **Criar novo edital**, o preview mostra:

```text
☐ Tornar o edital importado o principal
```

- marcado: o novo edital torna-se o único principal e o principal atual é arquivado, preservando dados e estatísticas;
- desmarcado: o novo edital nasce arquivado em **Editais anteriores** e o principal atual permanece inalterado.

O checkbox deve iniciar **desmarcado** para evitar efeitos laterais silenciosos.

Não será criado o conceito de “edital secundário ativo” nesta feature.

### 3.4 Ambiguidade de disciplina

Dentro do edital destino:

- 0 correspondências por nome normalizado → `CREATE`;
- 1 correspondência → `REUSE`;
- 2 ou mais correspondências → `CREATE_CONFLICT`.

`CREATE_CONFLICT` cria uma nova disciplina e não altera nenhuma das homônimas existentes.

O preview deve deixar claro que houve conflito.

### 3.5 Ambiguidade de tópicos e aulas

A mesma regra vale dentro da disciplina resolvida:

- 0 correspondências → criar;
- 1 correspondência → reutilizar;
- 2 ou mais → criar um novo item por conflito.

Isso vale para assuntos/tópicos e aulas.

### 3.6 Reimportação

O importador deve reconhecer proveniência quando possível, mas nunca decidir o destino apenas com base nela.

Se um edital anteriormente importado estiver ativo e elegível como alvo, o usuário escolhe novamente entre:

- mesclar;
- criar outro edital independente.

Se a importação anterior estiver arquivada, ela pode ser mencionada como evidência de proveniência, mas não é alvo de merge.

### 3.7 Idempotência aprovada

A idempotência é definida por **mesmo payload lógico + mesmo destino de merge**.

Importar duas vezes no mesmo edital, escolhendo merge, não pode aumentar a quantidade de disciplinas, tópicos ou aulas quando nada novo foi adicionado ao JSON.

Por decisão explícita de produto, selecionar **Criar novo edital** novamente pode criar outro edital independente. Essa duplicação é deliberada e não é considerada falha de idempotência.

Essa regra refina o critério de aceite original da issue, que falava em idempotência absoluta.

## 4. Schema de entrada

Versão inicial:

```json
{
  "versao": 1,
  "tipo": "edital",
  "nome": "DPE-PB — Assistente Jurídico",
  "sourceRevision": "dpe-tjpb-bridge-v1.1",
  "disciplinas": [
    {
      "nome": "Direito Constitucional",
      "topicos": [
        { "nome": "Direitos Fundamentais" }
      ],
      "aulas": [
        { "nome": "Controle de Constitucionalidade" }
      ]
    }
  ]
}
```

Campos de proveniência adicionais podem ser aceitos:

- `centralId`;
- `sourceRef`;
- `planId`;
- hashes;
- outros campos futuros desconhecidos.

Campos desconhecidos devem ser tolerados, desde que os campos obrigatórios sejam válidos.

## 5. Validação

Criar `validateEditalImportPayload(payload)` como função pura.

Regras mínimas:

- payload deve ser objeto JSON;
- `versao === 1`;
- `tipo === "edital"`;
- `nome` não vazio;
- `disciplinas` deve ser array não vazio;
- cada disciplina deve possuir `nome` não vazio;
- `topicos`, quando presentes, devem ser arrays;
- `aulas`, quando presentes, devem ser arrays;
- cada tópico/aula deve ser objeto com `nome` não vazio;
- a validação não pode mutar o payload.

Erros devem apontar o caminho lógico do campo, por exemplo:

```text
disciplinas[2].nome: campo obrigatório.
```

JSON inválido ou schema inválido encerra o fluxo antes do preview.

## 6. Normalização de nomes

O matching nominal usa chave determinística equivalente à já usada na Reta Final:

1. converter para string;
2. lowercase;
3. Unicode NFD;
4. remover diacríticos;
5. colapsar espaços;
6. trim.

Exemplo:

```text
"Direito  Penal "
"direito penal"
"DIREITO PENAL"
→ "direito penal"
```

O importador de edital não deve importar `reta-final-core.js` apenas para obter essa função.

Durante a implementação, há duas opções aceitáveis:

1. extrair `normalizeNameKey` para utilitário neutro se isso puder ser feito com risco baixo e testes cobrindo a Reta Final; ou
2. manter uma função local equivalente no novo núcleo.

Não deve ser introduzido acoplamento artificial entre os dois subsistemas apenas para evitar algumas linhas duplicadas.

## 7. Proveniência e identidade da fonte

A identidade humana do edital é o nome normalizado. Ela auxilia a escolha de destino, mas não é suficiente para afirmar que dois editais são a mesma origem.

A importação deve derivar `sourceIdentity` com preferência por identificadores estáveis:

```text
centralId
    ↓
sourceRef
    ↓
identidade canônica derivada
```

`sourceRevision` representa a revisão da fonte, e não a identidade.

Exemplo:

```text
centralId igual + sourceRevision diferente
= revisões diferentes do mesmo edital-fonte
```

### 7.1 Fingerprint

Não usar hash dos bytes brutos do JSON.

O fingerprint deve ser derivado de uma representação canônica, para que espaços, indentação e ordem irrelevante de propriedades não criem identidades falsas.

A composição exata pode ser definida no plano de implementação, mas deve usar somente dados estáveis de identidade/proveniência, não progresso local.

### 7.2 Metadados persistidos

Editais criados/importados podem armazenar:

```js
importMetadata: {
  tipo: 'edital',
  source: 'central-concursos',
  centralId: null,
  sourceRef: null,
  sourceRevision: null,
  fingerprint: null,
  lastImportedAt: null
}
```

Campos ausentes permanecem `null` ou são omitidos de forma consistente.

Em merge, somente os metadados de proveniência do edital podem ser atualizados. Progresso acadêmico não pode ser alterado.

## 8. Seleção de destino

Antes do matching interno, o importador resolve o destino.

### 8.1 Candidatos

Somente editais não arquivados são elegíveis para merge.

Candidatos podem ser sugeridos por:

- nome normalizado;
- proveniência persistida compatível.

A proveniência melhora a explicação do preview, mas não autoriza merge automático.

### 8.2 Modos

O draft do preview possui:

```js
destinationMode: 'merge' | 'create'
targetEditalId: string | null
makePrincipal: boolean
```

Quando o usuário alternar entre merge e create, o matching deve ser recalculado puramente para refletir exatamente o novo destino.

Nenhuma mutação de `state` ocorre nessa etapa.

## 9. Matching interno

Depois que o destino é escolhido, todo matching de disciplinas, tópicos e aulas é limitado ao edital destino.

Nunca procurar uma disciplina homônima em outro edital para reutilizá-la.

### 9.1 Disciplina

Para cada disciplina importada:

```text
0 matches  → CREATE
1 match    → REUSE
2+ matches → CREATE_CONFLICT
```

### 9.2 Tópico/assunto

Dentro da disciplina resolvida:

```text
0 matches  → CREATE
1 match    → REUSE
2+ matches → CREATE_CONFLICT
```

### 9.3 Aula

Mesma regra:

```text
0 matches  → CREATE
1 match    → REUSE
2+ matches → CREATE_CONFLICT
```

### 9.4 Reuso nunca sobrescreve

Uma entidade classificada como `REUSE` usa o ID e o objeto existentes.

É proibido aplicar padrões como:

```js
Object.assign(existing, imported)
{ ...existing, ...imported }
```

sobre entidades reutilizadas.

## 10. Preservação de progresso

O importador não pode resetar ou substituir, entre outros:

### Assuntos

- `concluido`;
- `dataConclusao`;
- `revisoesFetas`;
- `adiamentos`;
- `linkedAulaIds`;
- quaisquer campos futuros de progresso.

### Aulas

- `estudada`;
- `dataEstudo`;
- `progress`;
- `linkedAssuntoIds`;
- quaisquer campos futuros de progresso.

### Estado externo ao edital

A importação não deve modificar:

- `state.eventos`;
- histórico;
- `state.habitos`;
- `state.revisoes`;
- `state.config`;
- planejamento atual;
- Reta Final;
- sessões;
- estatísticas derivadas existentes.

A única exceção estrutural é a mudança de principal quando o usuário marca explicitamente **Tornar o edital importado o principal**.

## 11. Import plan

O matcher não deve aplicar alterações diretamente.

Ele produz um artefato explícito, por exemplo:

```js
{
  source: {
    centralId,
    sourceRef,
    sourceRevision,
    fingerprint
  },

  destination: {
    mode: 'merge',
    editalId: 'ed_123',
    makePrincipal: false
  },

  edital: {
    status: 'matched'
  },

  disciplinas: [
    {
      nome: 'Direito Constitucional',
      action: 'reuse',
      existingId: 'disc_1',
      topicos: [
        {
          nome: 'Direitos Fundamentais',
          action: 'reuse',
          existingId: 'ass_1'
        }
      ],
      aulas: []
    }
  ],

  conflicts: [],

  summary: {
    disciplinasReutilizadas: 1,
    disciplinasNovas: 0,
    disciplinasConflitantes: 0,
    topicosReutilizados: 1,
    topicosNovos: 0,
    topicosConflitantes: 0,
    aulasReutilizadas: 0,
    aulasNovas: 0,
    aulasConflitantes: 0
  }
}
```

O preview renderiza esse plano.

A confirmação aplica **esse mesmo plano**, em vez de fazer matching silencioso novamente.

## 12. Proteção contra preview obsoleto

Entre preview e confirmação, o estado pode mudar.

O import plan deve carregar uma assinatura suficiente do destino analisado para detectar mudanças incompatíveis.

Na confirmação:

- se o alvo não existir mais;
- se deixar de ser elegível;
- ou se a estrutura relevante tiver mudado de modo que invalide o plano;

a importação aborta sem mutação e solicita novo preview:

```text
O estado dos editais mudou desde o preview.
Revise a importação novamente.
```

Não é necessário bloquear mudanças irrelevantes em outras áreas do aplicativo.

## 13. Aplicação atômica

O apply deve ocorrer sobre uma cópia da estrutura relevante antes de substituir a estrutura real.

Conceitualmente:

```text
state.editais
    ↓
clone
    ↓
applyEditalImport(clone, importPlan)
    ↓
validação pós-merge
    ↓
commit em state.editais
    ↓
invalidate caches
    ↓
scheduleSave()
    ↓
render
```

Se o apply lançar erro, `state.editais` real permanece intacto.

Não usar `setState(..., { merge: true })` como mecanismo genérico de importação. O merge genérico por IDs não conhece as regras de matching por nome nem as garantias de progresso desta feature.

### 13.1 Criação de entidades

Entidades novas devem usar os defaults locais já adotados pelo app.

Exemplo conceitual de assunto novo:

```js
{
  id: generatedId,
  nome,
  concluido: false,
  dataConclusao: null,
  revisoesFetas: [],
  adiamentos: 0,
  linkedAulaIds: []
}
```

Exemplo conceitual de aula nova:

```js
{
  id: generatedId,
  nome,
  descricao: '',
  estudada: false,
  dataEstudo: null,
  progress: 0,
  linkedAssuntoIds: []
}
```

A implementação deve confirmar os defaults atuais antes de codificar.

### 13.2 Principal único

Ao criar um edital com `makePrincipal=true`, a aplicação deve produzir um estado final equivalente ao comportamento de `makeEditalPrincipal()`:

- novo edital não arquivado;
- todos os outros editais ativos arquivados;
- dados dos editais anteriores preservados.

Com `makePrincipal=false`, o novo edital deve nascer arquivado e não alterar o principal atual.

A transição deve fazer parte da mesma operação atômica da importação.

## 14. UX

### 14.1 Entrada

Adicionar ação visível em **Editais**, próxima de **Novo Edital**:

```text
Importar Edital (JSON)
```

A action sugerida é:

```text
open-edital-import
```

### 14.2 File picker

- `accept=".json"`;
- parse local;
- funciona offline;
- nenhuma dependência de backend.

### 14.3 Preview

Reutilizar o padrão visual do `#modal-prompt` já utilizado pelo app e pela Reta Final.

O preview mostra:

- nome do edital;
- proveniência/revisão, quando disponível;
- destino;
- escolha merge × create;
- checkbox de principal em modo create;
- totais reutilizados/criados/conflitantes;
- árvore por disciplina;
- badges visuais;
- aviso de preservação de progresso;
- botão final **Importar edital**.

Estados visuais sugeridos:

```text
✓ reutilizar
+ criar
⚠ conflito — criar novo
```

### 14.4 Exemplo de preview

```text
┌──────────────────────────────────────────────────────┐
│ Importar Edital                                      │
├──────────────────────────────────────────────────────┤
│ DPE-PB — Assistente Jurídico                         │
│ Fonte: Central de Concursos · revisão v1.3           │
│                                                      │
│ DESTINO                                              │
│ ● Mesclar com DPE-PB — Assistente Jurídico           │
│ ○ Criar um novo edital                               │
│                                                      │
│ 8 disciplinas reutilizadas · 2 novas                 │
│ 42 tópicos reutilizados · 13 novos · 2 conflitos     │
│ 16 aulas reutilizadas · 4 novas                      │
│                                                      │
│ Direito Constitucional                    ✓ reutilizar│
│   Direitos Fundamentais                   ✓           │
│   Controle Concentrado                    +           │
│                                                      │
│ Direito Penal                            ⚠ conflito  │
│   2 disciplinas homônimas; será criada uma nova.     │
│                                                      │
│ ✓ progresso existente não será sobrescrito           │
│                                                      │
│                  [Cancelar] [Importar edital]         │
└──────────────────────────────────────────────────────┘
```

### 14.5 Create mode

```text
● Criar um novo edital

☐ Tornar o edital importado o principal

Se desmarcado, ele será criado em Editais anteriores
sem alterar o edital principal atual.
```

Se marcado:

```text
⚠ O edital principal atual será arquivado.
Dados, estatísticas e progresso serão preservados.
```

### 14.6 Reimportação reconhecida

Quando houver proveniência compatível:

```text
Este arquivo parece ser uma nova versão de um edital já importado.

Anterior: dpe-tjpb-bridge-v1.1
Atual:    dpe-tjpb-bridge-v1.3
```

Se o edital correspondente estiver ativo, ele pode ser sugerido como destino de merge.

Se estiver arquivado, a mensagem é apenas informativa e o edital não fica selecionável como destino.

## 15. Estado efêmero da UI

`src/js/views/edital-import.js` pode manter um draft somente durante o modal:

```js
{
  payload,
  sourceIdentity,
  destinationMode,
  targetEditalId,
  makePrincipal,
  importPlan
}
```

Fechar ou cancelar o modal descarta o draft.

Nenhum estado parcial da importação é persistido antes da confirmação.

## 16. Arquitetura proposta

### 16.1 Núcleo puro

Novo arquivo sugerido:

`src/js/logic/edital-import-core.js`

Responsabilidades:

- `validateEditalImportPayload`;
- normalização/identidade;
- análise de candidatos;
- `matchEditalImportToState`;
- `buildEditalImportPlan`;
- aplicação pura sobre cópia;
- summary/conflicts;
- detecção de plano obsoleto quando possível sem estado global.

O núcleo não deve importar `state`, DOM, app ou views.

### 16.2 Camada de UI/orquestração

Novo arquivo sugerido:

`src/js/views/edital-import.js`

Responsabilidades:

- file picker;
- parse;
- mensagens de erro;
- draft do preview;
- render do preview;
- atualização do preview ao mudar destino;
- confirmação;
- clone/apply/commit;
- cache invalidation;
- `scheduleSave()`;
- render;
- toast final.

### 16.3 Actions

Preferir registrar `open-edital-import` em:

`src/js/ui/actions/editais.js`

Não é necessário criar um módulo de actions novo se o domínio Editais já é o ponto canônico para essas ações.

### 16.4 Integrações adicionais

A implementação deve inspecionar e ajustar somente se necessário:

- `src/js/components.js` — header/action bar;
- `src/js/views/editais-view.js` — empty state/ações locais;
- `src/sw.js` — cache do novo módulo, conforme padrão atual;
- cache-busting/versionamento já adotado pelo projeto.

Evitar alterações em módulos não relacionados.

## 17. Estratégia de testes

### 17.1 Validação unitária

Cobrir:

- payload válido;
- payload não objeto;
- `versao` inválida;
- `tipo` inválido;
- nome ausente;
- disciplinas vazias;
- disciplina sem nome;
- tópico inválido;
- aula inválida;
- campos extras tolerados;
- payload não mutado.

### 17.2 Matching unitário

Em edital, disciplina, tópico e aula:

```text
0 → CREATE
1 → REUSE
2+ → CREATE_CONFLICT
```

Também testar:

- case-insensitive;
- acentos;
- espaços repetidos;
- editais arquivados fora do matching;
- matching restrito ao destino;
- homônimos em outros editais ignorados;
- proveniência não causa merge automático.

### 17.3 Preservação

Criar fixtures com progresso real.

Após merge de assunto já existente, validar que permanecem iguais:

- `concluido`;
- `dataConclusao`;
- `revisoesFetas`;
- `adiamentos`;
- `linkedAulaIds`.

Após merge de aula existente:

- `estudada`;
- `dataEstudo`;
- `progress`;
- `linkedAssuntoIds`.

Sempre que possível, comparar o objeto reutilizado antes/depois, exceto campos que a spec explicitamente permita alterar. O conteúdo acadêmico reutilizado não deve ser reescrito.

### 17.4 Idempotência

Caso obrigatório:

```text
S
↓ importar X com merge em E
S1
↓ importar X novamente com merge em E
S2
```

Esperado:

- número de editais em S1 == S2;
- número de disciplinas em S1 == S2;
- número de tópicos em S1 == S2;
- número de aulas em S1 == S2;
- progresso preservado.

Metadados de proveniência podem refletir a importação mais recente.

Caso separado:

```text
reimportar X
→ escolher "Criar novo"
→ novo edital independente é permitido
```

### 17.5 Atomicidade

Testar erro intencional no apply e garantir que o estado original não foi parcialmente modificado.

### 17.6 Preview obsoleto

Gerar preview, alterar o destino de forma incompatível e confirmar.

Esperado:

- zero mutações;
- mensagem pedindo novo preview.

## 18. E2E

Criar suíte dedicada, sugerida:

`tests/e2e/edital-import.spec.js`

Cenários mínimos:

1. **Novo edital**
   - abrir Editais;
   - importar JSON;
   - visualizar preview;
   - criar;
   - conferir estrutura.

2. **Merge parcial**
   - seed com edital parcialmente preenchido;
   - importar;
   - escolher merge;
   - conferir reutilizados e novos.

3. **Preservação**
   - assunto/aula com progresso;
   - merge;
   - verificar progresso intacto.

4. **Conflito**
   - duas disciplinas homônimas;
   - preview informa conflito;
   - confirmação cria nova;
   - duas antigas intactas.

5. **Reimportação + merge**
   - importar;
   - reimportar;
   - merge;
   - zero duplicatas estruturais.

6. **Criar novamente deliberadamente**
   - reimportar;
   - escolher create;
   - novo edital independente criado.

7. **Tornar principal**
   - create + checkbox marcado;
   - anterior arquivado;
   - novo é único principal.

8. **Não tornar principal**
   - create + checkbox desmarcado;
   - novo nasce arquivado;
   - principal anterior permanece.

9. **Schema inválido**
   - rejeição antes do preview;
   - estado intacto.

## 19. Critérios de aceite refinados

A implementação estará concluída quando:

- importar JSON de edital válido;
- rejeitar schema inválido com mensagem clara;
- mostrar preview antes de qualquer mutação;
- oferecer merge/create quando houver edital ativo correspondente;
- criar novo edital arquivado por padrão em create mode;
- promover o novo apenas quando o usuário marcar explicitamente a opção;
- reutilizar correspondência única dentro do destino;
- criar novo item em ausência de correspondência;
- criar novo item com aviso quando houver ambiguidade;
- ignorar editais arquivados como alvo de matching;
- preservar todo progresso existente;
- não alterar eventos, histórico, hábitos, revisões, planejamento ou configurações;
- ser idempotente quando repetido como merge no mesmo destino;
- permitir duplicação deliberada quando o usuário escolher create;
- funcionar offline/local-first;
- possuir testes unitários de validação, matching, merge, preservação, atomicidade e idempotência;
- possuir E2E de preview → confirmação → persistência.

## 20. Fora de escopo

Não faz parte da #100:

- criar múltiplos editais ativos;
- alterar a regra de edital principal único;
- reativar automaticamente editais arquivados;
- importar ou restaurar backup completo;
- modificar o planejamento ativo;
- sincronizar diretamente com a Central de Concursos por rede/API;
- resolver manualmente cada ambiguidade escolhendo entre duplicatas;
- fazer fuzzy matching aproximado além da normalização determinística de nome;
- reorganizar ou refatorar amplamente o sistema de editais.

## 21. Riscos e mitigação

### Matching incorreto

Mitigação: matching restrito ao destino e regra 0/1/2+.

### Perda de progresso

Mitigação: `REUSE` nunca recebe spread/assign do payload; testes de preservação.

### Duplicação em reimportação

Mitigação: idempotência por nome normalizado no mesmo destino e testes repetidos.

### Preview diferente do apply

Mitigação: preview e confirmação compartilham o mesmo import plan, com proteção contra stale state.

### Quebra do principal único

Mitigação: create mode arquiva o novo por padrão; promoção explícita e atômica.

### Acoplamento com Reta Final

Mitigação: novo núcleo independente; compartilhar somente utilitário neutro se a extração for comprovadamente segura.

## 22. Sequência recomendada de implementação

A implementação deverá ser planejada separadamente com o skill `writing-plans`, mas a ordem arquitetural esperada é:

1. contratos e testes do core;
2. validação;
3. identidade/proveniência;
4. matching + import plan;
5. apply atômico + stale guard;
6. UI/preview;
7. actions e integração em Editais;
8. E2E;
9. regressão completa e cache bump conforme convenções do repositório.

Nenhuma implementação deve começar até a aprovação desta spec e a criação do plano de implementação.
