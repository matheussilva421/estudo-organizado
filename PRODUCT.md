# Product

## Register

product

## Users

Concurseiros brasileiros em preparação de longo prazo (meses a anos) rumo a uma data de prova específica.

- **Contexto de uso:** rotina de estudo diária/semanal, frequentemente sob pressão e ansiedade. Sessões longas de foco intercaladas com registro de questões, leituras e revisões. Usam no desktop (sessão de estudo planejada, painel completo) e no celular (PWA instalável, consulta rápida, registro em movimento, uso offline).
- **Job-to-be-done:** sustentar uma rotina de estudos disciplinada e mensurável — planejar *o que* estudar (Calendário, Ciclo de Estudos), executar com foco (Study Organizer, Cronômetro, Pomodoro), medir o progresso (Dashboard, Histórico, progresso no edital) e corrigir o rumo (Revisões espaçadas, Inteligência de Banca).
- **O que mais importa para eles:**
  1. **Saber o próximo passo** — clareza imediata sobre "o que eu faço agora" a cada sessão.
  2. **Progresso tangível** — sentir avanço constante e confiável rumo à prova, em números nos quais confia.
  3. **Nunca perder dados** — certeza de que nada do que registraram será perdido (local-first + sync multi-dispositivo).
  4. **Constância** — voltar todos os dias e manter a rotina viva.

## Product Purpose

App web/PWA **local-first** para planejamento e organização de estudos para concursos, estruturado pelo **ciclo PDCA** (planejar → executar → medir → corrigir).

Existe para transformar a maratona caótica de preparação para concurso em um **sistema mensurável e legível** — um painel de controle preciso para a própria preparação, não um caderno bonito. Nunca perde dados (IndexedDB como banco primário, emergency save, sync via Firestore/Cloudflare/Google Drive com tombstones de exclusão).

**Sucesso** = o estudante volta todos os dias, confia nos números que vê, sabe exatamente qual o próximo passo, e percebe avanço constante rumo à prova.

## Brand Personality

**Preciso, técnico, denso.** A interface é um instrumento de medição da própria preparação — um painel profissional, não um app de motivação.

- **Voz:** clara, direta e factual. Fala como uma ferramenta de trabalho séria: informa, não vende; mostra o número, não comemora por você.
- **Sensação alvo:** controle e domínio. O usuário deve sentir que tem *todos os dados à mão de uma vez*, organizados com precisão — a densidade é um recurso desejado por quem quer ver o quadro inteiro, não um defeito a esconder.
- **Densidade com hierarquia, nunca poluição.** "Denso" significa alta razão sinal/ruído: muita informação útil, ordenada por importância, com alinhamento rigoroso e respiro proporcional. Não significa amontoado. Cada número tem seu peso tipográfico e seu lugar.
- **Identidade visual já comprometida (preservar):** paleta escura própria com 6 temas nomeados (Grafite, Ardósia, Platina, Terminal, Neon, Arrakis), accent steel-blue por padrão, tipografia Plus Jakarta Sans (texto) + DM Mono (números/status/dados). A personalidade técnica vem dessa identidade escura e do par tipográfico texto+mono — **essa identidade deve ser preservada, não substituída.**

## Anti-references

- **SaaS genérico.** Cards com gradiente, template de hero-metric (número gigante + label pequeno + stats de apoio + accent em gradiente), dashboard que poderia ser de qualquer startup. Nada de identidade emprestada.
- **Corporativo/estéril.** Material Design padrão, cinza empresarial, sensação de "planilha de RH" ou ferramenta interna sem alma.
- Densidade não é desculpa para **poluição**: muita informação sem hierarquia, alinhamento ou respiro é tão ruim quanto um SaaS vazio. O alvo é o painel preciso, não o caos.

## Design Principles

1. **Precisão é a estética.** A beleza vem do rigor: alinhamento exato, números monoespaçados que tabulam, hierarquia tipográfica deliberada. Um painel preciso é mais bonito que um decorado.
2. **Densidade com sinal alto.** Mostrar muito é desejado — desde que cada elemento seja útil e ordenado por importância. Densidade é o oposto de poluição: muito sinal, pouco ruído, hierarquia clara.
3. **O dado é o herói; a tarefa é o foco.** Os números (tempo, questões, progresso no edital, constância) são visíveis, confiáveis e legíveis — sempre a serviço de "o que faço agora", nunca como decoração ou troféu vazio.
4. **Nunca perder o trabalho do usuário.** A integridade de dados é parte da experiência, não detalhe de engenharia. Estados de salvamento e sync sempre legíveis e tranquilizadores; ações destrutivas, sempre deliberadas.
5. **Identidade própria, não template.** A "cara" do app vem da paleta escura comprometida e do par tipográfico texto+mono — não do SaaS-cream nem do corporate-gray. Em dúvida, escolher o que reforça a identidade existente e a precisão.

## Accessibility & Inclusion

- **Alvo: WCAG AA — em todos os 6 temas.** Texto de corpo ≥ 4.5:1 contra o fundo; texto grande (≥18px ou bold ≥14px) ≥ 3:1. Cada variante escura (Grafite, Ardósia, Platina, Terminal, Neon, Arrakis) precisa manter o contraste AA, não só o tema padrão. A densidade nunca pode custar legibilidade: números mono e labels pequenos exigem atenção extra ao contraste.
- **Teclado:** skip links e foco visível já presentes (`src/css/base/accessibility.css`); navegação completa por teclado deve ser mantida.
- **Toque:** alvos mínimos de 44px (já implementados para `pointer: coarse`).
- **Movimento:** `prefers-reduced-motion: reduce` obrigatório para toda animação — alternativa de crossfade ou transição instantânea.
- **Idioma:** conteúdo em português (pt-BR); copy clara, factual e sem jargão desnecessário.
