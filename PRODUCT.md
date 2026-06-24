# Product

## Register

product

## Users

Estudantes de concurso público brasileiros, em preparação de longo prazo (meses a anos) rumo a uma data de prova específica.

- **Contexto de uso:** rotina de estudo diária/semanal, muitas vezes sob pressão e ansiedade. Sessões longas de foco intercaladas com registro de questões, leituras e revisões. Usam tanto no desktop (sessão de estudo planejada) quanto no celular (PWA instalável, consulta rápida, registro em movimento, uso offline).
- **Job-to-be-done:** sustentar uma rotina de estudos disciplinada e mensurável — planejar *o que* estudar (Calendário, Ciclo de Estudos), executar com foco (Study Organizer, Cronômetro, Pomodoro), medir o progresso (Dashboard, Histórico, progresso no edital) e corrigir o rumo (Revisões espaçadas, Inteligência de Banca).
- **O que mais importa para eles:** clareza sobre "o que faço agora", sensação tangível de progresso, e a certeza de que nada do que registraram será perdido (local-first + sync multi-dispositivo).

## Product Purpose

App web/PWA **local-first** para planejamento e organização de estudos para concursos, estruturado pelo **ciclo PDCA** (planejar → executar → medir → corrigir).

Existe para transformar a maratona caótica de preparação para concurso em um sistema sustentável e mensurável, sem nunca perder dados (IndexedDB como banco primário, emergency save, sync via Firestore/Cloudflare/Google Drive com tombstones de exclusão).

**Sucesso** = o estudante volta todos os dias, confia nos números que vê, sabe exatamente qual o próximo passo, e sente que está avançando de forma constante rumo à prova.

## Brand Personality

**Foco & calma.** Três palavras: *focado, calmo, confiável.*

- **Voz:** clara, direta e encorajadora — sem ser barulhenta nem vendedora. Fala como uma ferramenta de trabalho séria, não como um app de motivação.
- **Sensação alvo:** controle e tranquilidade. A interface deve *reduzir* a ansiedade da preparação, não competir por atenção. É uma ferramenta silenciosa que sai do caminho e deixa o estudante estudar.
- **Identidade visual já comprometida:** paleta escura própria, com 6 temas nomeados (Grafite, Ardósia, Platina, Terminal, Neon, Arrakis), accent steel-blue por padrão, tipografia Plus Jakarta Sans (texto) + DM Mono (números/status). A personalidade vem dessa paleta escura e da tipografia — não de adornos. Essa identidade deve ser **preservada**, não substituída.

## Anti-references

- **SaaS genérico.** Cards com gradiente, template de hero-metric (número gigante + label pequeno + stats de apoio + accent em gradiente), dashboard que poderia ser de qualquer startup. Nada de identidade emprestada.
- **Corporativo/estéril.** Material Design padrão, cinza empresarial, sensação de "planilha de RH" ou ferramenta interna sem alma.
- Por extensão, evitar também o **infantil/gamificado** (mascotes, confete, badges por toda parte que trivializam o esforço) e o **denso/poluído** (informação demais na tela sem respiro nem hierarquia).

## Design Principles

1. **Calma sobre estímulo.** A tela existe para reduzir ansiedade. Cada elemento ganha seu lugar, seu respiro e sua hierarquia; o que não serve à tarefa atual recua. Densidade controlada, nunca poluição.
2. **O dado é o herói; o foco é a tarefa.** Os números (tempo, questões, progresso no edital, constância) são visíveis e confiáveis — mas sempre a serviço de "o que faço agora", nunca como decoração ou troféu vazio.
3. **Confiança pela consistência.** Uma identidade própria (temas escuros nomeados, tokens em fonte única) aplicada com rigor em todas as 13 telas e 6 temas. Previsível e coeso é o que gera confiança — o oposto do template genérico.
4. **Nunca perder o trabalho do usuário.** A integridade de dados é parte da experiência, não um detalhe de engenharia. Estados de salvamento e sync devem ser sempre legíveis e tranquilizadores; ações destrutivas, sempre deliberadas.
5. **Identidade própria, não template.** A "cara" do app vem da paleta escura comprometida e da tipografia — não do SaaS-cream nem do corporate-gray. Quando em dúvida, escolher o que reforça a identidade existente.

## Accessibility & Inclusion

- **Alvo: WCAG AA.** Texto de corpo ≥ 4.5:1 contra o fundo; texto grande (≥18px ou bold ≥14px) ≥ 3:1. Vale para **todos os 6 temas** — cada variante escura precisa manter o contraste AA, não só o tema padrão (Grafite).
- **Teclado:** skip links e foco visível já presentes (`src/css/base/accessibility.css`); navegação completa por teclado deve ser mantida.
- **Toque:** alvos mínimos de 44px (já implementados para `pointer: coarse`).
- **Movimento:** `prefers-reduced-motion: reduce` obrigatório para toda animação — alternativa de crossfade ou transição instantânea.
- **Idioma:** conteúdo em português (pt-BR); copy clara e sem jargão desnecessário.
