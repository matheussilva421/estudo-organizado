# Modelo de Ameaças de Sync e Persistência

## Objetivo

Registrar os principais riscos de segurança e integridade ligados à persistência local, exportação/importação e sincronização remota do Estudo Organizado.

## Escopo

Este documento cobre:

- IndexedDB
- `localStorage`
- Cloudflare sync
- Google Drive sync
- importação/exportação de JSON
- exposição de dados via XSS ou configuração fraca

## Ativos protegidos

- histórico de estudo do usuário
- editais, disciplinas e tópicos
- revisões e planejamento
- metadados de sync e backup
- segredos de integração, como tokens e client IDs

## Premissas

- o app roda em contexto de navegador
- todo dado persistido no cliente deve ser tratado como sensível para o usuário
- qualquer XSS relevante pode expor dados e configurações locais
- sync remoto hoje é single-user e centrado em snapshots

## Superfícies de ataque

### 1. XSS e HTML dinâmico

O app usa `innerHTML` em várias superfícies. Mesmo com `esc()`, isso aumenta o risco de regressões futuras e dificulta CSP estrito.

Impacto:

- leitura de dados do `state`
- extração de tokens armazenados localmente
- adulteração de payloads de sync

### 2. Armazenamento local de segredos

Hoje existem valores de sync e integração próximos do estado persistido do app.

Impacto:

- segredos podem ser exportados junto do estado
- uma falha de XSS pode exfiltrar dados e credenciais em um único vetor

### 3. Worker com fronteiras permissivas

O Worker atual aceita CORS amplo e autenticação simples por bearer token.

Impacto:

- superfície maior para uso indevido do endpoint
- menor separação entre origens esperadas e inesperadas

### 4. Overwrite de snapshots remotos

O modelo atual é simples e pode sofrer com sobrescrita indevida se um dispositivo estiver desatualizado ou se houver erro na comparação de timestamps.

Impacto:

- perda silenciosa de dados
- divergência entre dispositivos

### 5. Importação de JSON

Mesmo com validações estruturais, a importação precisa tratar conteúdo como não confiável.

Impacto:

- corromper estado
- reintroduzir formatos antigos ou inválidos
- causar falhas posteriores de renderização

## Ameaças principais

### T1. Exfiltração via XSS

Condição:

- um HTML dinâmico inseguro ou futura regressão injeta script executável

Impacto:

- leitura de dados locais
- leitura de tokens e configs de sync
- sync malicioso

Mitigação recomendada:

- remover handlers inline
- reduzir `innerHTML`
- endurecer CSP
- isolar segredos do estado exportável

### T2. Sync remoto sobrescrevendo estado mais novo

Condição:

- timestamp local/remoto insuficiente ou inconsistente

Impacto:

- perda de informação

Mitigação recomendada:

- envelope versionado
- `updatedAt` explícito
- `deviceId`
- restore manual separado de sync automático

### T3. Uso indevido do endpoint Cloudflare

Condição:

- origem arbitrária acessa o endpoint com token válido vazado

Impacto:

- leitura e escrita remota indevida

Mitigação recomendada:

- restringir origens
- limitar métodos e payload
- rotacionar segredo
- mover para bindings/segredos estritos

### T4. Vazamento em backup/export

Condição:

- exportação inclui segredos que deveriam ser operacionais

Impacto:

- compartilhamento acidental de credenciais

Mitigação recomendada:

- separar dados exportáveis de dados operacionais
- documentar claramente o conteúdo do backup

## Mitigações prioritárias

### Prioridade 0

- parar de ampliar o uso de handlers inline
- reduzir dependência de `unsafe-inline` e `unsafe-eval`
- impedir que novos segredos entrem no snapshot exportável

### Prioridade 1

- formalizar contrato versionado de sync
- endurecer Worker com CORS restrito
- separar UX de sync de UX de backup

### Prioridade 2

- adicionar logs estruturados e diagnósticos
- criar documentação operacional de restore e incidente

## Regras práticas para mudanças futuras

- nenhum novo token deve entrar em exportação de dados sem revisão explícita
- todo HTML dinâmico novo deve preferir DOM seguro ou escape rigoroso
- toda mudança de sync deve especificar comportamento em conflito
- toda ação destrutiva ou de restore deve exigir confirmação clara

