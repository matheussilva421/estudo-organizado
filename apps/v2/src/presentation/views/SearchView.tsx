import { useMemo, useState } from 'react';
import type { ContentSnapshot } from '../../application/content-service';
import {
  searchExperience,
  type SearchResult,
} from '../../application/experience-queries';
import type { PlanBlock, PlanningScenario } from '../../domain/planning';
import type { ReviewCommitment } from '../../domain/review';
import type { StudySession } from '../../domain/session';
import type { AppRoute } from '../routing';
import { routeHref, routeWithQuery } from '../routing';

type Props = {
  profileId: string;
  route: AppRoute;
  content: ContentSnapshot;
  scenarios: PlanningScenario[];
  blocks: PlanBlock[];
  sessions: StudySession[];
  commitments: ReviewCommitment[];
  navigate: (next: AppRoute, options?: { replace?: boolean }) => void;
};

const KIND_LABELS: Record<SearchResult['kind'], string> = {
  edital: 'Edital',
  disciplina: 'Disciplina',
  assunto: 'Assunto',
  aula: 'Aula',
  planejamento: 'Planejamento',
  bloco: 'Bloco',
  sessao: 'Sessão',
  revisao: 'Revisão',
};

export function SearchView({
  profileId,
  route,
  content,
  scenarios,
  blocks,
  sessions,
  commitments,
  navigate,
}: Props) {
  const initial = route.query.q ?? '';
  const [query, setQuery] = useState(initial);

  const results = useMemo(
    () =>
      searchExperience(
        { content, scenarios, blocks, sessions, commitments },
        query,
        profileId,
      ),
    [content, scenarios, blocks, sessions, commitments, query, profileId],
  );
  const truncated = results.length >= 30;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    navigate(routeWithQuery({ ...route, module: 'search' }, 'q', query.trim() || null), {
      replace: true,
    });
  }

  function openResult(result: SearchResult) {
    if (result.target === 'content') {
      if (!result.editalId) return;
      navigate({
        module: 'content',
        entityId: result.editalId,
        query: { focus: result.id },
        invalid: false,
      });
      return;
    }
    navigate({
      module: result.target,
      entityId: null,
      query: { focus: result.id },
      invalid: false,
    });
  }

  return (
    <section className="view search-view" aria-labelledby="search-title" data-testid="f6-search">
      <header className="view-header">
        <div>
          <p className="eyebrow">Busca local</p>
          <h2 id="search-title">Localizar no acervo deste perfil</h2>
          <p className="view-subtitle">
            Encontra registros mesmo fora da árvore visível. Funciona offline e não envia dados.
          </p>
        </div>
      </header>

      <form className="search-form" role="search" onSubmit={submit}>
        <label htmlFor="f6-search-input">Buscar edital, disciplina, assunto ou aula</label>
        <div className="search-row">
          <input
            id="f6-search-input"
            type="search"
            autoFocus
            value={query}
            maxLength={120}
            placeholder="Ex.: constitucional, crase, aula 12"
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="button-primary">
            Buscar
          </button>
        </div>
      </form>

      <div className="search-status" role="status" aria-live="polite">
        {query.trim().length < 2
          ? 'Digite ao menos 2 caracteres. A busca não altera nenhum registro.'
          : results.length === 0
            ? 'Nenhum resultado neste perfil. Ajuste o termo; nada foi criado.'
            : truncated
              ? 'Mostrando até 30 resultados; refine o termo para localizar outros.'
              : String(results.length) +
                ' resultado(s), ordenados por correspondência e identidade estável.'}
      </div>

      {results.length > 0 ? (
        <ul className="search-results">
          {results.map((result) => (
            <li key={`${result.kind}-${result.id}`}>
              <button
                type="button"
                className="search-result"
                onClick={() => openResult(result)}
                data-result-kind={result.kind}
              >
                <span className="chip chip-hint">{KIND_LABELS[result.kind]}</span>
                <span className="search-result-title">{result.title}</span>
                <span className="search-result-context">{result.context}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="source-note">
        Índice derivado de F2–F5 neste dispositivo. Texto de origem é sempre exibido como texto.
      </p>

      <p className="muted">
        <a href={routeHref({ module: 'content', entityId: null, query: {}, invalid: false })}>
          Voltar ao conteúdo
        </a>
      </p>
    </section>
  );
}

