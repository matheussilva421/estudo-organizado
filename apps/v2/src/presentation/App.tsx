import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StudySubject } from '../domain/subject';
import type { EditalDiscipline } from '../domain/edital';
import type { Assunto, Aula, LessonTopicLink } from '../domain/content';
import { EXECUTION_DATA_STATE } from '../domain/delete';
import type { CommitResult } from '../application/content-commands';
import type { ContentSnapshot } from '../application/content-service';
import type { ProfileRecord } from '../application/profile-service';
import type { ImportPreview as ImportPreviewModel } from '../application/import-types';
import { parseEditalImport, previewEditalImport } from '../application/import-service';
import { assessSyncHealth } from '../application/sync-policy';
import {
  getDatabaseUpgradeState,
  getPendingOutbox,
  LocalPersistenceError,
  subscribeDatabaseUpgrade,
  type DatabaseUpgradeState,
} from '../platform/indexeddb';
import { ImportCommitter } from '../platform/import-commit';
import { LocalContentRepository } from '../platform/local-content-repository';
import { LocalProfileRepository } from '../platform/local-profile-repository';
import { LocalSubjectRepository } from '../platform/local-subject-repository';
import { subscribeLocalChanges } from '../platform/local-events';
import { getE2EFault } from '../platform/e2e-fault';
import { EditalManager } from './components/EditalManager';
import { ContentTree } from './components/ContentTree';
import { ImportPreview } from './components/ImportPreview';
import { SubjectForm } from './components/SubjectForm';
import { SubjectList } from './components/SubjectList';
import { SyncStatus } from './components/SyncStatus';
import { PlanningWorkspace } from './PlanningWorkspace';
import { SessionWorkspace } from './SessionWorkspace';
import { ReviewWorkspace } from './ReviewWorkspace';
import { canSubmitTitle, initialFormState, markSubmitFailure, THEMES, type FormState } from './ui-state';
import {
  buildHomeSummary,
  type AnalyticsSummary,
  type HomeSummary,
} from '../application/experience-queries';
import {
  ExperienceProjectionCache,
  cachedAnalytics,
} from '../application/experience-cache';
import { ReviewService, type ReviewReminderSummary } from '../application/review-service';
import { LocalPlanningRepository } from '../platform/local-planning-repository';
import { LocalReviewRepository } from '../platform/local-review-repository';
import { LocalSessionRepository } from '../platform/local-session-repository';
import type { PlanBlock, PlanningScenario } from '../domain/planning';
import type { StudySession } from '../domain/session';
import type { ReviewCommitment } from '../domain/review';
import { AppNav } from './AppNav';
import { HomeView } from './views/HomeView';
import { SearchView } from './views/SearchView';
import { AnalyticsView } from './views/AnalyticsView';
import { AttentionView } from './views/AttentionView';
import { SettingsView, type Density } from './views/SettingsView';
import { NotFoundView } from './views/NotFoundView';
import { useHashRoute } from './use-hash-route';
import { routeHref, routeLabel, type RouteModule } from './routing';
import {
  clearLocalDraft,
  loadLocalDraft,
  localDraftKey,
  saveLocalDraft,
} from './local-drafts';
import {
  confirmNavigationIntent,
  hasDirtyDrafts,
  installBeforeUnloadGuard,
  useDraftGuard,
} from './draft-guard';

const PROFILE_ID = 'local-default';
const ZONE = 'America/Fortaleza';
const THEME_KEY = 'estudo-organizado:v2:theme';
const DENSITY_KEY = 'estudo-organizado:v2:density';
const SUBJECT_DRAFT_KEY = localDraftKey(PROFILE_ID, 'subject-new');

type ExperienceData = {
  scenarios: PlanningScenario[];
  blocks: PlanBlock[];
  sessions: StudySession[];
  commitments: ReviewCommitment[];
  sessionConflicts: number;
  reminders: ReviewReminderSummary | null;
};

const EMPTY_EXPERIENCE: ExperienceData = {
  scenarios: [],
  blocks: [],
  sessions: [],
  commitments: [],
  sessionConflicts: 0,
  reminders: null,
};

const SECTION_BY_MODULE: Partial<Record<RouteModule, string>> = {
  home: 'home-section',
  content: 'content-section',
  planning: 'planning-section',
  sessions: 'sessions-section',
  reviews: 'reviews-section',
  analytics: 'analytics-section',
  attention: 'attention-section',
  settings: 'settings-section',
  search: 'search-section',
};

function todayInZone(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function readStoredPreference(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storePreference(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // The preference stays in memory when storage is unavailable.
  }
}

function initialTheme(): string {
  const stored = readStoredPreference(THEME_KEY);
  return THEMES.some((option) => option.id === stored) ? (stored as string) : 'grafite';
}

function initialDensity(): Density {
  return readStoredPreference(DENSITY_KEY) === 'compact' ? 'compact' : 'comfortable';
}

function newId(): string {
  return crypto.randomUUID();
}

function persistenceMessage(error: unknown): string {
  if (error instanceof LocalPersistenceError) {
    if (error.kind === 'QUOTA') return 'Espaço insuficiente neste navegador. O texto foi preservado.';
    if (error.kind === 'ABORT') return 'Gravação interrompida. O texto foi preservado; tente novamente.';
    if (error.kind === 'BLOCKED_UPGRADE') return 'Banco bloqueado por outra aba. Recarregue para continuar.';
  }
  return 'Não foi possível salvar neste dispositivo. O texto foi preservado.';
}

function resultMessage(result: CommitResult<unknown>, success: string): string | null {
  if (result.kind === 'LOCAL_COMMITTED') return null;
  if (result.kind === 'INVALID') return `Ação recusada (${result.code.replaceAll('_', ' ').toLowerCase()}).`;
  if (result.kind === 'CONFLICT') return 'Conflito com o estado atual. Recarregue e revise antes de repetir.';
  return `Não foi possível gravar (${result.reason.toLowerCase()}). ${success}`;
}

const EMPTY_SNAPSHOT: ContentSnapshot = {
  subjects: [],
  editais: [],
  links: [],
  assuntos: [],
  aulas: [],
  lessonTopics: [],
};

export function App() {
  const { route, navigate } = useHashRoute();
  const [content, setContent] = useState<ContentSnapshot>(EMPTY_SNAPSHOT);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [form, setForm] = useState<FormState>(() => {
    const draft = loadLocalDraft(SUBJECT_DRAFT_KEY);
    return draft && draft.value.trim().length > 0
      ? { ...initialFormState, title: draft.value }
      : initialFormState;
  });
  const [draftRestored, setDraftRestored] = useState<boolean>(() => {
    const draft = loadLocalDraft(SUBJECT_DRAFT_KEY);
    return Boolean(draft && draft.value.trim().length > 0);
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [theme, setTheme] = useState<string>(initialTheme);
  const [density, setDensity] = useState<Density>(initialDensity);
  const [ready, setReady] = useState(false);
  const [selectedEditalId, setSelectedEditalId] = useState<string | null>(null);
  const [startBlockId, setStartBlockId] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [upgrade, setUpgrade] = useState<DatabaseUpgradeState>(getDatabaseUpgradeState());
  const [experience, setExperience] = useState<ExperienceData>(EMPTY_EXPERIENCE);
  const [searchDraft, setSearchDraft] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [experienceError, setExperienceError] = useState(false);
  const [today, setToday] = useState<string>(() => todayInZone());
  const refreshSeq = useRef(0);
  const [analyticsCache] = useState(() => new ExperienceProjectionCache());

  useDraftGuard('f2-subject', form.title.trim().length > 0, 'nova disciplina');

  const contentRepository = useCallback(
    () => new LocalContentRepository({ fault: getE2EFault() }),
    [],
  );
  const profileRepository = useCallback(() => new LocalProfileRepository(), []);
  const reviewService = useMemo(
    () =>
      new ReviewService(
        new LocalReviewRepository(),
        new LocalSessionRepository(),
        new LocalPlanningRepository(),
      ),
    [],
  );

  const refresh = useCallback(async (): Promise<boolean> => {
    const generation = refreshSeq.current + 1;
    refreshSeq.current = generation;
    try {
      const [snapshot, record, outbox] = await Promise.all([
        contentRepository().loadContent(PROFILE_ID),
        profileRepository().getProfile(PROFILE_ID),
        getPendingOutbox(PROFILE_ID),
      ]);
      const [scenarios, blocks, sessions, conflicts] = await Promise.all([
        new LocalPlanningRepository().listScenarios(PROFILE_ID),
        new LocalPlanningRepository().listBlocks(PROFILE_ID),
        new LocalSessionRepository().listSessions(PROFILE_ID),
        new LocalSessionRepository().listSessionConflicts(PROFILE_ID),
      ]);

      let reminders: ReviewReminderSummary | null = null;
      let commitments: ReviewCommitment[] = [];
      let partialReadError = false;
      try {
        [reminders, commitments] = await Promise.all([
          reviewService.reminders(PROFILE_ID),
          reviewService.listCommitments(PROFILE_ID),
        ]);
      } catch {
        reminders = null;
        commitments = [];
        partialReadError = true;
      }

      if (generation !== refreshSeq.current) return false;
      analyticsCache.clear();
      setContent(snapshot);
      setProfile(record);
      setPending(outbox.length);
      setExperience({
        scenarios,
        blocks,
        sessions,
        commitments,
        sessionConflicts: conflicts.length,
        reminders,
      });
      setExperienceError(partialReadError);
      setLoadError(null);
      setSelectedEditalId((current) => {
        if (current && snapshot.editais.some((edital) => edital.id === current)) return current;
        const firstActive = snapshot.editais.find((edital) => edital.status === 'ACTIVE');
        return firstActive?.id ?? null;
      });
      return true;
    } catch (error) {
      if (generation !== refreshSeq.current) return false;
      setLoadError(persistenceMessage(error));
      return false;
    } finally {
      if (generation === refreshSeq.current) setReady(true);
    }
  }, [analyticsCache, contentRepository, profileRepository, reviewService]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh().catch((error) => setNotice(persistenceMessage(error)));
    return subscribeLocalChanges(PROFILE_ID, () => {
      refresh().catch(() => undefined);
    });
  }, [refresh]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    storePreference(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.density = density;
    storePreference(DENSITY_KEY, density);
  }, [density]);

  useEffect(() => subscribeDatabaseUpgrade(setUpgrade), []);

  useEffect(() => installBeforeUnloadGuard(), []);

  useEffect(() => {
    const tick = () => setToday(todayInZone());
    const timer = window.setInterval(tick, 60_000);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  useEffect(() => {
    if (route.invalid) return;
    const section = SECTION_BY_MODULE[route.module];
    if (!section) return;
    const timer = window.setTimeout(() => {
      document.getElementById(section)?.scrollIntoView({ block: 'start', behavior: 'auto' });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [route]);

  const apply = useCallback(
    async (run: () => Promise<CommitResult<unknown>>, success: string) => {
      setNotice(null);
      let result: CommitResult<unknown>;
      try {
        result = await run();
      } catch (error) {
        setNotice(persistenceMessage(error));
        return { kind: 'FAILED', reason: 'UNKNOWN' } as CommitResult<unknown>;
      }
      const refreshed = await refresh();
      if (result.kind === 'LOCAL_COMMITTED' && !refreshed) {
        setNotice(
          'Salvo localmente, mas a atualização visual falhou. Recarregue antes de repetir a ação.',
        );
      } else {
        setNotice(resultMessage(result, success));
      }
      return result;
    },
    [refresh],
  );

  function updateSubjectTitle(title: string): void {
    setForm({ ...form, title, error: null });
    setDraftRestored(false);
    if (title.trim().length > 0) {
      saveLocalDraft({
        key: SUBJECT_DRAFT_KEY,
        profileId: PROFILE_ID,
        entityId: null,
        baseRevision: null,
        value: title,
      });
    } else {
      clearLocalDraft(SUBJECT_DRAFT_KEY);
    }
  }

  async function createSubject(): Promise<void> {
    if (!canSubmitTitle(form.title)) {
      setForm({ ...form, error: 'Informe um nome de disciplina.' });
      return;
    }
    setForm({ ...form, submitting: true, error: null });
    setNotice(null);
    try {
      await new LocalSubjectRepository({ fault: getE2EFault() }).execute({
        operationId: newId(),
        profileId: PROFILE_ID,
        subjectId: newId(),
        type: 'create',
        title: form.title,
      });
      clearLocalDraft(SUBJECT_DRAFT_KEY);
      setDraftRestored(false);
      setForm(initialFormState);
      await refresh();
    } catch (error) {
      setForm(markSubmitFailure(form, persistenceMessage(error)));
    }
  }

  async function renameSubject(subject: StudySubject, title: string): Promise<void> {
    setNotice(null);
    try {
      await new LocalSubjectRepository({ fault: getE2EFault() }).execute({
        operationId: newId(),
        profileId: PROFILE_ID,
        subjectId: subject.id,
        type: 'rename',
        title,
        baseRevision: subject.localRevision,
      });
      await refresh();
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        (error as { code?: string }).code === 'CONFLICT'
      ) {
        setNotice('Conflito: outra aba alterou esta disciplina. Revise o texto antes de repetir.');
        throw error;
      }
      setNotice(persistenceMessage(error));
      throw error;
    }
  }

  const routeSelectedId =
    route.module === 'content' ? route.entityId ?? route.query.edital ?? null : null;
  const routeSelectedExists =
    routeSelectedId !== null && content.editais.some((edital) => edital.id === routeSelectedId);
  const effectiveSelectedEditalId =
    routeSelectedId !== null ? (routeSelectedExists ? routeSelectedId : null) : selectedEditalId;
  const selected =
    content.editais.find((edital) => edital.id === effectiveSelectedEditalId) ?? null;
  const selectedLinks = selected
    ? content.links.filter((link) => link.editalId === selected.id && link.status === 'ACTIVE')
    : [];
  const linkIds = new Set(selectedLinks.map((link) => link.id));
  const scopedAssuntos = content.assuntos.filter((item) => linkIds.has(item.editalDisciplineId));
  const scopedAulas = content.aulas.filter((item) => linkIds.has(item.editalDisciplineId));
  const scopedTopics = content.lessonTopics.filter((topic) =>
    scopedAulas.some((aula) => aula.id === topic.aulaId),
  );

  const health = assessSyncHealth({
    localCommitted: content.editais.length > 0 || content.subjects.length > 0,
    remoteCommitted: false,
    verifiedCursor: null,
    pendingCount: pending,
    mode: profile?.state ?? 'LOCAL_ONLY',
  });

  const homeSummary: HomeSummary = useMemo(
    () =>
      buildHomeSummary(
        {
          profileId: PROFILE_ID,
          content,
          scenarios: experience.scenarios,
          blocks: experience.blocks,
          sessions: experience.sessions,
          reminders: experience.reminders,
          pendingOutbox: pending,
          upgradeBlocked: upgrade.blocked,
          sessionConflicts: experience.sessionConflicts,
          dataError: loadError !== null || experienceError,
        },
        today,
      ),
    [content, experience, pending, upgrade.blocked, today, loadError, experienceError],
  );
  const analytics: AnalyticsSummary = useMemo(
    () =>
      cachedAnalytics(
        analyticsCache,
        {
          profileId: PROFILE_ID,
          content,
          scenarios: experience.scenarios,
          blocks: experience.blocks,
          sessions: experience.sessions,
          sessionConflicts: experience.sessionConflicts,
        },
        today,
      ),
    [analyticsCache, content, experience, today],
  );

  const routeEditalId =
    route.module === 'content' ? route.entityId ?? route.query.edital ?? null : null;
  const routeEditalMissing =
    ready && routeEditalId !== null && !content.editais.some((edital) => edital.id === routeEditalId);
  const focusedId = route.query.focus ?? null;
  const attentionCount =
    homeSummary.counts.reviewsDue +
    (pending > 0 ? 1 : 0) +
    (upgrade.blocked ? 1 : 0) +
    (experience.sessionConflicts > 0 ? 1 : 0) +
    (loadError !== null || experienceError ? 1 : 0);
  const isOverview = route.module === 'overview';
  const showContent = !route.invalid && (isOverview || route.module === 'content');
  const showPlanning = !route.invalid && (isOverview || route.module === 'planning');
  const showSessions = !route.invalid && (isOverview || route.module === 'sessions');
  const showReviews = !route.invalid && (isOverview || route.module === 'reviews');

  function submitGlobalSearch(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const value = searchDraft.trim();
    navigate({
      module: 'search',
      entityId: null,
      query: value ? { q: value } : {},
      invalid: false,
    });
  }

  function guardInternalNavigation(event: React.MouseEvent<HTMLDivElement>): void {
    const element = event.target as HTMLElement | null;
    const anchor = element?.closest('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href') ?? '';
    if (!href.startsWith('#')) return;
    if (!href.startsWith('#/')) {
      event.preventDefault();
      const id = decodeURIComponent(href.slice(1));
      const target = document.getElementById(id);
      if (!target) return;
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'start' });
      return;
    }
    if (!hasDirtyDrafts()) return;
    if (!confirmNavigationIntent(anchor.textContent?.trim() ?? 'outra área')) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  return (
    <div
      className="app-shell"
      onClickCapture={guardInternalNavigation}
      data-db-ready={ready ? 'true' : 'false'}
      data-db-upgrade={upgrade.kind}
      data-execution={EXECUTION_DATA_STATE}
      data-route={route.module}
    >
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          const main = document.getElementById('main-content');
          main?.focus();
          main?.scrollIntoView({ block: 'start' });
        }}
      >
        Pular para o conteúdo
      </a>

      <header className="app-header">
        <div className="brand">
          <h1>
            <a href={routeHref({ module: 'home', entityId: null, query: {}, invalid: false })}>
              Estudo Organizado V2
            </a>
          </h1>
          <p className="app-subtitle">
            Experiência integrada local-first: organizar, planejar, estudar, revisar e analisar.
          </p>
        </div>

        <form className="global-search" role="search" onSubmit={submitGlobalSearch}>
          <label className="sr-only" htmlFor="global-search-input">
            Busca global local
          </label>
          <input
            id="global-search-input"
            type="search"
            value={searchDraft}
            maxLength={120}
            placeholder="Buscar no acervo local"
            onChange={(event) => setSearchDraft(event.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="button-ghost">
            Buscar
          </button>
        </form>

        <label className="theme-picker">
          Tema
          <select value={theme} onChange={(event) => setTheme(event.target.value)}>
            {THEMES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      <main id="main-content" className="app-main" tabIndex={-1}>
        <p className="route-announcer" role="status" aria-live="polite">
          {routeLabel(route.module)}
        </p>

        <SyncStatus health={health} />

        {route.invalid ? <NotFoundView /> : null}

        {!route.invalid && route.module === 'home' ? (
          <div id="home-section">
            <HomeView
              summary={homeSummary}
              ready={ready}
              loadError={loadError}
              experienceError={experienceError}
              onRetry={() => {
                setLoadError(null);
                setReady(false);
                void refresh();
              }}
            />
          </div>
        ) : null}

        {!route.invalid && route.module === 'search' ? (
          <div id="search-section">
            <SearchView
              key={route.query.q ?? ''}
              profileId={PROFILE_ID}
              route={route}
              content={content}
              scenarios={experience.scenarios}
              blocks={experience.blocks}
              sessions={experience.sessions}
              commitments={experience.commitments}
              navigate={navigate}
            />
          </div>
        ) : null}

        {!route.invalid && route.module === 'analytics' ? (
          <div id="analytics-section">
            <AnalyticsView analytics={analytics} />
          </div>
        ) : null}

        {!route.invalid && route.module === 'attention' ? (
          <div id="attention-section">
            <AttentionView
              summary={homeSummary}
              health={health}
              pendingOutbox={pending}
              upgradeBlocked={upgrade.blocked}
            />
          </div>
        ) : null}

        {!route.invalid && route.module === 'settings' ? (
          <div id="settings-section">
            <SettingsView
              themes={THEMES}
              theme={theme}
              onThemeChange={setTheme}
              density={density}
              onDensityChange={setDensity}
              onReset={() => {
                setTheme('grafite');
                setDensity('comfortable');
              }}
              health={health}
              pendingOutbox={pending}
              upgrade={upgrade}
            />
          </div>
        ) : null}

        <div id="content-section" className="module-section" hidden={!showContent}>
          {routeEditalMissing ? (
            <p className="inline-notice" role="status">
              O edital informado na rota não existe neste perfil ou foi arquivado. Nenhum dado de
              outro perfil foi exibido.
            </p>
          ) : null}

          <p className="execution-state" data-state={EXECUTION_DATA_STATE}>
        Progresso de estudo: <strong>{EXECUTION_DATA_STATE}</strong> — sessões F4 registradas
        localmente; nada é estimado aqui.
      </p>

      {upgrade.blocked ? (
        <p className="inline-notice upgrade-blocked" role="alert">
          Atualização do banco bloqueada por outra aba do V2. Feche ou recarregue a outra aba (ou esta)
          para concluir. Nada foi apagado e as edições ficam bloqueadas até a liberação.
        </p>
      ) : null}

      <section className="panel" aria-labelledby="subjects-title">
        <h2 id="subjects-title">Disciplinas canônicas</h2>
        <SubjectForm
          form={form}
          onTitleChange={updateSubjectTitle}
          onSubmit={createSubject}
          locked={upgrade.blocked}
        />
        {notice ? (
          <p className="inline-notice" role="alert">
            {notice}
          </p>
        ) : null}
        {draftRestored && form.title.trim().length > 0 ? (
          <p className="hint" role="status" data-testid="f6-draft-restored">
            Rascunho local recuperado. Confirme a criação para gravar; nada foi salvo como
            disciplina ainda.
          </p>
        ) : null}
        <SubjectList subjects={content.subjects} onRename={renameSubject} ready={ready} />
      </section>

      <EditalManager
            profileId={PROFILE_ID}
        editais={content.editais}
        primaryEditalId={profile?.primaryEditalId ?? null}
        subjects={content.subjects}
            selectedId={effectiveSelectedEditalId}
        onSelect={setSelectedEditalId}
        onCreate={(title) =>
          apply(
            () =>
              contentRepository().execute({
                type: 'CREATE_EDITAL',
                operationId: newId(),
                profileId: PROFILE_ID,
                editalId: newId(),
                title,
              }),
            'Tente novamente.',
          ).then((result) => result.kind === 'LOCAL_COMMITTED')
        }
        onRename={(edital, title, baseRevision) =>
          apply(
            () =>
              contentRepository().execute({
                type: 'RENAME_EDITAL',
                operationId: newId(),
                profileId: PROFILE_ID,
                editalId: edital.id,
                title,
                baseRevision,
              }),
            'Tente novamente.',
          ).then((result) => result.kind === 'LOCAL_COMMITTED')
        }
        onArchive={(edital, replacement) =>
          apply(
            () =>
              profileRepository().archiveEdital({
                profileId: PROFILE_ID,
                editalId: edital.id,
                operationId: newId(),
                replacementPrimaryId: replacement,
                baseRevision: edital.localRevision,
              }),
            'Tente novamente.',
          ).then((result) => result.kind === 'LOCAL_COMMITTED')
        }
        onReactivate={(editalId) =>
          apply(
            () =>
              contentRepository().execute({
                type: 'RESTORE_ENTITY',
                operationId: newId(),
                profileId: PROFILE_ID,
                entityType: 'edital',
                entityId: editalId,
              }),
            'Tente novamente.',
          ).then((result) => result.kind === 'LOCAL_COMMITTED')
        }
        onSetPrimary={(editalId) =>
          apply(
            () =>
              profileRepository().setPrimaryEdital({
                profileId: PROFILE_ID,
                editalId,
                operationId: newId(),
                baseRevision: profile?.localRevision ?? null,
              }),
            'Tente novamente.',
          ).then((result) => result.kind === 'LOCAL_COMMITTED')
        }
        onLinkSubject={(editalId, subjectId) =>
          apply(
            () =>
              contentRepository().execute({
                type: 'LINK_SUBJECT',
                operationId: newId(),
                profileId: PROFILE_ID,
                editalId,
                subjectId,
                linkId: newId(),
              }),
            'Tente novamente.',
          ).then((result) => result.kind === 'LOCAL_COMMITTED')
        }
        locked={upgrade.blocked || selected?.status === 'ARCHIVED'}
      />

      <section className="panel" aria-labelledby="tree-title">
        <h2 id="tree-title">Verticalização {selected ? `— ${selected.title}` : ''}</h2>
        {selected?.status === 'ARCHIVED' ? (
          <p className="inline-notice" role="status">
            Edital arquivado: consulta liberada, edição bloqueada até a reativação.
          </p>
        ) : null}
        {selected ? (
            <ContentTree
                profileId={PROFILE_ID}
              focusId={focusedId}
            links={selectedLinks}
            assuntos={scopedAssuntos}
            aulas={scopedAulas}
            lessonTopics={scopedTopics}
            subjects={content.subjects}
            onCreateAssunto={(link: EditalDiscipline, title, parentId) =>
              apply(
                () =>
                  contentRepository().execute({
                    type: 'UPSERT_ASSUNTO',
                    operationId: newId(),
                    profileId: PROFILE_ID,
                    value: {
                      id: newId(),
                      profileId: PROFILE_ID,
                      editalDisciplineId: link.id,
                      parentId,
                      parentKey: parentId ?? '',
                      title,
                      orderKey: '',
                      localRevision: 0,
                    },
                  }),
                'Tente novamente.',
              ).then((result) => result.kind === 'LOCAL_COMMITTED')
            }
            onCreateAula={(link: EditalDiscipline, title) =>
              apply(
                () =>
                  contentRepository().execute({
                    type: 'UPSERT_AULA',
                    operationId: newId(),
                    profileId: PROFILE_ID,
                    value: {
                      id: newId(),
                      profileId: PROFILE_ID,
                      editalDisciplineId: link.id,
                      title,
                      orderKey: '',
                      localRevision: 0,
                    },
                  }),
                'Tente novamente.',
              ).then((result) => result.kind === 'LOCAL_COMMITTED')
            }
            onLinkTopic={(aula: Aula, assunto: Assunto) =>
              apply(
                () =>
                  contentRepository().execute({
                    type: 'LINK_LESSON_TOPIC',
                    operationId: newId(),
                    profileId: PROFILE_ID,
                    link: {
                      id: newId(),
                      profileId: PROFILE_ID,
                      aulaId: aula.id,
                      assuntoId: assunto.id,
                      localRevision: 0,
                    },
                  }),
                'Tente novamente.',
              ).then((result) => result.kind === 'LOCAL_COMMITTED')
            }
            onUnlinkTopic={(topic: LessonTopicLink) =>
              apply(
                () =>
                  contentRepository().execute({
                    type: 'UNLINK_LESSON_TOPIC',
                    operationId: newId(),
                    profileId: PROFILE_ID,
                    linkId: topic.id,
                    baseRevision: topic.localRevision,
                  }),
                'Tente novamente.',
              ).then((result) => result.kind === 'LOCAL_COMMITTED')
            }
            locked={upgrade.blocked || selected?.status === 'ARCHIVED'}
          />
        ) : (
          <p className="empty-state">Selecione ou crie um edital para verticalizar o conteúdo.</p>
        )}
      </section>

        </div>

        <div id="planning-section" hidden={!showPlanning}>
      <PlanningWorkspace
        profileId={PROFILE_ID}
        content={content}
        locked={upgrade.blocked}
            focusId={focusedId}
        onNotice={setNotice}
        onStartPlannedBlock={(blockId) =>
          setStartBlockId(blockId + '#' + Date.now())
        }
      />

        </div>

        <div id="sessions-section" hidden={!showSessions}>
      <SessionWorkspace
        profileId={PROFILE_ID}
        content={content}
        locked={upgrade.blocked}
            focusId={focusedId}
        onNotice={setNotice}
        startBlockId={startBlockId}
        onStartBlockConsumed={() => setStartBlockId(null)}
      />

        </div>

        <div id="reviews-section" hidden={!showReviews}>
      <ReviewWorkspace
        profileId={PROFILE_ID}
        content={content}
        locked={upgrade.blocked}
            focusId={focusedId}
        onNotice={setNotice}
      />

        </div>

        <div id="content-tools" hidden={!showContent}>
      <ImportPreview
        locked={upgrade.blocked}
        onPreview={async (text, namespace) => {
          const parsed = parseEditalImport(text, { namespace });
          if (!parsed.ok) return { error: parsed.reason };
          return previewEditalImport(parsed.parsed, content);
        }}
        onConfirm={async (preview: ImportPreviewModel) => {
          const result = await new ImportCommitter().apply(PROFILE_ID, preview, {
            confirmed: true,
            targetSignature: preview.targetSignature,
          });
          await refresh();
          return result.kind === 'LOCAL_COMMITTED';
        }}
      />

        </div>
      </main>

      <AppNav
        current={route.module}
        attentionCount={attentionCount}
        reviewCount={homeSummary.counts.reviewsDue}
      />

      <footer className="app-footnote">
        Os dados ficam no IndexedDB isolado desta origem. Nenhuma sincronização real é executada
        nesta fase. Rota atual: {routeHref(route)}.
      </footer>
    </div>
  );
}
