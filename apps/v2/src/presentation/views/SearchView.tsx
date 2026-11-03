import { useMemo, useState } from 'react';
import type { ContentSnapshot } from '../../application/content-service';
import { searchContent, type SearchResult } from '../../application/experience-queries';
import type { AppRoute } from '../routing';
import { routeHref, routeWithQuery } from '../routing';

type Props = {
  profileId: string;
  route: AppRoute;
  content: ContentSnapshot;
  navigate: (next: AppRoute, options?: { replace?: boolean }) => void;
};

const KIND_LABELS: Record<SearchResult['kind'], string> = {
  edital: 'Edital',
  disciplina: 'Disciplina',
  assunto: 'Assunto',
  aula: 'Aula',
};

export function SearchView({ profileId, route, content, navigate }: Props) {
  const initial = route.query.q ?? '';
  const [query, setQuery] = useState(initial);

  const results = useMemo(
    () => searchContent(content, query, profileId),
    [content, query, profileId],
  );

  function submit(event: React.FormEvent) {
    event.preventDefault();
    navigate(routeWithQuery({ ...route, module: 'search' }, 'q', query.trim() || null), {
      replace: true,
    });
  }

  function openResult(result: SearchResult) {
    if (!result.editalId) return;
    navigate({
      module: 'content',
      entityId: result.editalId,
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
            : `${results.length} resultado(s), ordenados por correspondência e identidade estável.`}
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
        Índice derivado de F2 neste dispositivo. Texto de origem é sempre exibido como texto.
      </p>

      <p className="muted">
        <a href={routeHref({ module: 'content', entityId: null, query: {}, invalid: false })}>
          Voltar ao conteúdo
        </a>
      </p>
    </section>
  );
}

