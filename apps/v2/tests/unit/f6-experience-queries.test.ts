import { describe, expect, it } from 'vitest';
import {
  buildAnalytics,
  buildHomeSummary,
  compareAnalytics,
  formatFocusDuration,
  normalizeSearchText,
  orderPrioritiesForMode,
  searchContent,
  searchExperience,
  selectHomeIndicators,
  type PriorityItem,
} from '../../src/application/experience-queries';
import type { ReviewReminderSummary } from '../../src/application/review-service';
import type { ContentSnapshot } from '../../src/application/content-service';
import type { PlanBlock, PlanningScenario } from '../../src/domain/planning';
import type { StudySession } from '../../src/domain/session';
import type { ReviewCommitment } from '../../src/domain/review';

const PROFILE = 'p1';
const TODAY = '2026-11-03';

function contentFixture(): ContentSnapshot {
  return {
    subjects: [
      { id: 's1', profileId: PROFILE, title: 'Direito Constitucional', localRevision: 1 },
    ],
    editais: [
      { id: 'e1', profileId: PROFILE, title: 'TRT 2026', status: 'ACTIVE', localRevision: 1 },
      { id: 'e2', profileId: PROFILE, title: 'TJ 2026', status: 'ACTIVE', localRevision: 1 },
    ],
    links: [
      {
        id: 'l1',
        profileId: PROFILE,
        editalId: 'e1',
        subjectId: 's1',
        orderKey: '000010',
        localRevision: 1,
        status: 'ACTIVE',
      },
    ],
    assuntos: [
      {
        id: 'a1',
        profileId: PROFILE,
        editalDisciplineId: 'l1',
        parentId: null,
        parentKey: '',
        title: 'Controle de constitucionalidade',
        orderKey: '000010',
        localRevision: 1,
      },
    ],
    aulas: [
      {
        id: 'au1',
        profileId: PROFILE,
        editalDisciplineId: 'l1',
        title: 'Aula 12 - Crase e acentuação',
        orderKey: '000010',
        localRevision: 1,
      },
    ],
    lessonTopics: [],
  };
}

function scenario(id = 'sc1', status: PlanningScenario['status'] = 'ACTIVE'): PlanningScenario {
  return {
    id,
    profileId: PROFILE,
    editalId: 'e1',
    kind: 'CYCLE',
    name: 'Ciclo principal',
    status,
    localRevision: 1,
    schemaVersion: 1,
    priorityProfileId: 'pp1',
    priorityProfileRevision: 1,
    referenceZone: 'America/Fortaleza',
  };
}

function block(overrides: Partial<PlanBlock> & Pick<PlanBlock, 'id' | 'civilDate'>): PlanBlock {
  return {
    profileId: PROFILE,
    editalId: 'e1',
    scenarioId: 'sc1',
    editalDisciplineId: 'l1',
    plannedMinutes: 50,
    allocation: 'CONFIRMED_DAY',
    priority: 1,
    localRevision: 1,
    sourceOperationId: 'op-' + overrides.id,
    label: 'Bloco ' + overrides.id,
    ...overrides,
  };
}

function session(
  overrides: Partial<StudySession> & Pick<StudySession, 'id' | 'state'>,
): StudySession {
  return {
    profileId: PROFILE,
    origin: 'TIMER',
    localRevision: 1,
    schemaVersion: 1,
    referenceZone: 'America/Fortaleza',
    recordedAtCivilDate: TODAY,
    planBlockIds: [],
    editalIds: [],
    intervals: [],
    ...overrides,
  };
}

function commitment(overrides: Partial<ReviewCommitment> & Pick<ReviewCommitment, 'id' | 'label' | 'currentDueDate'>): ReviewCommitment {
  return {
    profileId: PROFILE,
    canonicalTopicKey: 't-' + overrides.id,
    topicLinkId: 'l1',
    editalId: 'e1',
    assuntoId: 'a1',
    originalDueDate: overrides.currentDueDate,
    status: 'PENDING',
    coverage: 'FULL',
    policyVersion: 1,
    source: 'MANUAL',
    localRevision: 1,
    history: [],
    ...overrides,
  };
}

function reminders(overdue: ReviewCommitment[], dueToday: ReviewCommitment[]): ReviewReminderSummary {
  return {
    overdue,
    dueToday,
    upcoming: [],
    message: 'teste',
    settings: {} as ReviewReminderSummary['settings'],
    dismissedIds: [],
    quietActive: false,
    externalNotificationPromise: false,
  };
}

describe('f6 local search', () => {
  it('normalizes accents and case without changing identity', () => {
    expect(normalizeSearchText('  Ação   Constitucional ')).toBe('acao constitucional');
  });

  it('finds records outside the rendered tree and ranks exact matches first', () => {
    const results = searchContent(contentFixture(), 'constitucional', PROFILE);
    expect(results.map((item) => item.kind)).toContain('disciplina');
    expect(results.map((item) => item.kind)).toContain('assunto');
    expect(results[0]?.title).toBe('Direito Constitucional');
    const crase = searchContent(contentFixture(), 'crase', PROFILE);
    expect(crase).toHaveLength(1);
    expect(crase[0]?.kind).toBe('aula');
  });

  it('requires at least two characters and never searches other profiles', () => {
    expect(searchContent(contentFixture(), 'a', PROFILE)).toEqual([]);
    const other = contentFixture();
    other.editais = other.editais.map((edital) => ({ ...edital, profileId: 'p2' }));
    const results = searchContent(other, 'TRT', PROFILE);
    expect(results).toEqual([]);
  });

  it('searches committed F3, F4 and F5 records with typed targets', () => {
    const results = searchExperience(
      {
        content: contentFixture(),
        scenarios: [scenario()],
        blocks: [block({ id: 'b-search', civilDate: TODAY })],
        sessions: [session({ id: 's-search', state: 'COMPLETED' })],
        commitments: [
          commitment({ id: 'c-search', label: 'Revisão de crase', currentDueDate: TODAY }),
        ],
      },
      'crase',
      PROFILE,
    );
    const review = results.find((result) => result.kind === 'revisao');
    expect(review?.target).toBe('reviews');
    expect(review?.title).toContain('crase');
    expect(results.some((result) => result.kind === 'sessao')).toBe(false);

    const planning = searchExperience(
      {
        content: contentFixture(),
        scenarios: [scenario()],
        blocks: [block({ id: 'b-search', civilDate: TODAY })],
        sessions: [session({ id: 's-search', state: 'COMPLETED' })],
        commitments: [],
      },
      'Ciclo principal',
      PROFILE,
    );
    expect(planning[0]?.kind).toBe('planejamento');
    expect(planning[0]?.target).toBe('planning');

    const sessions = searchExperience(
      {
        content: contentFixture(),
        scenarios: [],
        blocks: [],
        sessions: [session({ id: 's-search', state: 'COMPLETED' })],
        commitments: [],
      },
      'Sessão',
      PROFILE,
    );
    expect(sessions[0]?.kind).toBe('sessao');
    expect(sessions[0]?.target).toBe('sessions');
  });
});

describe('f6 home priorities', () => {
  it('puts an active session first and explains its category', () => {
    const summary = buildHomeSummary(
      {
        profileId: PROFILE,
        content: contentFixture(),
        scenarios: [scenario()],
        blocks: [block({ id: 'b1', civilDate: TODAY })],
        sessions: [session({ id: 'sess1', state: 'RUNNING' })],
        reminders: null,
        pendingOutbox: 0,
        upgradeBlocked: false,
      },
      TODAY,
    );
    expect(summary.activeSession?.id).toBe('sess1');
    expect(summary.nextAction?.category).toBe('SESSAO_ATIVA');
    expect(summary.counts.plannedToday).toBe(1);
  });

  it('distinguishes a real delay from a planned item already executed', () => {
    const late = block({ id: 'b-late', civilDate: '2026-11-01' });
    const done = block({ id: 'b-done', civilDate: '2026-10-31' });
    const summary = buildHomeSummary(
      {
        profileId: PROFILE,
        content: contentFixture(),
        scenarios: [scenario()],
        blocks: [late, done],
        sessions: [session({ id: 's1', state: 'COMPLETED', planBlockIds: ['b-done'] })],
        reminders: null,
        pendingOutbox: 0,
        upgradeBlocked: false,
      },
      TODAY,
    );
    const lateItems = summary.priorities.filter((item) => item.category === 'ATRASO_REAL');
    expect(lateItems.map((item) => item.id)).toEqual(['block-late-b-late']);
  });

  it('keeps commitments and suggestions distinguishable and ordered stably', () => {
    const overdue = commitment({ id: 'c1', label: 'Crase', currentDueDate: '2026-11-01' });
    const dueToday = commitment({ id: 'c2', label: 'Constitucional', currentDueDate: TODAY });
    const summary = buildHomeSummary(
      {
        profileId: PROFILE,
        content: contentFixture(),
        scenarios: [scenario()],
        blocks: [],
        sessions: [],
        reminders: reminders([overdue], [dueToday]),
        pendingOutbox: 2,
        upgradeBlocked: false,
      },
      TODAY,
    );
    expect(summary.nextAction?.category).toBe('INTEGRIDADE');
    expect(summary.priorities.some((item) => item.category === 'REVISAO_ATRASADA')).toBe(true);
    expect(summary.priorities.some((item) => item.category === 'REVISAO_HOJE')).toBe(true);
    expect(summary.counts.reviewsDue).toBe(2);
  });

  it('offers contextual onboarding instead of inventing data', () => {
    const empty = buildHomeSummary(
      {
        profileId: PROFILE,
        content: {
          subjects: [],
          editais: [],
          links: [],
          assuntos: [],
          aulas: [],
          lessonTopics: [],
        },
        scenarios: [],
        blocks: [],
        sessions: [],
        reminders: null,
        pendingOutbox: 0,
        upgradeBlocked: false,
      },
      TODAY,
    );
    expect(empty.empty).toBe(true);
    expect(empty.nextAction?.category).toBe('ORIENTACAO');
    expect(empty.counts.completedLast7Days).toBe(0);
  });

  it('surfaces read failures and F4 conflicts as integrity, never as zero data', () => {
    const summary = buildHomeSummary(
      {
        profileId: PROFILE,
        content: {
          subjects: [],
          editais: [],
          links: [],
          assuntos: [],
          aulas: [],
          lessonTopics: [],
        },
        scenarios: [],
        blocks: [],
        sessions: [],
        reminders: null,
        pendingOutbox: 0,
        upgradeBlocked: false,
        sessionConflicts: 2,
        dataError: true,
      },
      TODAY,
    );
    expect(summary.empty).toBe(false);
    const ids = summary.priorities.map((item) => item.id);
    expect(ids).toContain('integrity-read-error');
    expect(ids).toContain('integrity-session-conflicts');
    expect(summary.nextAction?.category).toBe('INTEGRIDADE');
  });

  it('ignores editais from another profile when deriving the overview', () => {
    const content = contentFixture();
    content.editais = content.editais.map((edital) => ({ ...edital, profileId: 'p2' }));
    const summary = buildHomeSummary(
      {
        profileId: PROFILE,
        content,
        scenarios: [],
        blocks: [],
        sessions: [],
        reminders: null,
        pendingOutbox: 0,
        upgradeBlocked: false,
      },
      TODAY,
    );
    expect(summary.counts.activeEditais).toBe(0);
    expect(summary.empty).toBe(true);
  });
});

describe('f6 analytics projections', () => {
  const interval = (minutes: number) => ({
    id: 'i' + minutes,
    kind: 'FOCUS' as const,
    verifiedMs: minutes * 60000,
    contextId: null,
    checkpoint: null,
    recoveryFlag: false,
  });

  it('never counts a shared session twice and exposes partial data', () => {
    const solo = session({
      id: 'solo',
      state: 'COMPLETED',
      editalIds: ['e1'],
      intervals: [interval(30)],
      manualDeclaredMs: 5 * 60000,
      measurements: [{ id: 'm1', sessionId: 'solo', questions: 10, correctAnswers: 7 }],
      allocations: [
        { sessionId: 'solo', allocationId: 'al1', editalDisciplineId: 'l1', durationMs: 20 * 60000 },
      ],
    });
    const shared = session({
      id: 'shared',
      state: 'COMPLETED',
      editalIds: ['e1', 'e2'],
      intervals: [interval(60)],
    });
    const analytics = buildAnalytics(
      {
        profileId: PROFILE,
        content: contentFixture(),
        scenarios: [scenario()],
        blocks: [block({ id: 'b1', civilDate: TODAY })],
        sessions: [solo, shared],
      },
      TODAY,
    );
    expect(analytics.status).toBe('READY');
    expect(analytics.sessions.focusMs).toBe(95 * 60000);
    expect(analytics.sharedSessions).toBe(1);
    expect(analytics.byEdital).toHaveLength(1);
    expect(analytics.byEdital[0]?.focusMs).toBe(35 * 60000);
    expect(analytics.questions.accuracy).toBeCloseTo(0.7);
    expect(analytics.planned.minutes).toBe(50);
    expect(analytics.warnings.join(' ')).toContain('não são aditivos');
  });

  it('marks recovered intervals as partial instead of clean success', () => {
    const recovered = session({
      id: 'r1',
      state: 'COMPLETED',
      editalIds: ['e1'],
      intervals: [{ ...interval(20), recoveryFlag: true }],
    });
    const analytics = buildAnalytics(
      {
        profileId: PROFILE,
        content: contentFixture(),
        scenarios: [],
        blocks: [],
        sessions: [recovered],
      },
      TODAY,
    );
    expect(analytics.status).toBe('PARTIAL');
    expect(analytics.warnings.join(' ')).toContain('recuperados');
  });

  it('reports insufficient data without inventing zero performance', () => {
    const analytics = buildAnalytics(
      {
        profileId: PROFILE,
        content: contentFixture(),
        scenarios: [scenario()],
        blocks: [],
        sessions: [],
      },
      TODAY,
    );
    expect(analytics.status).toBe('INSUFFICIENT_DATA');
    expect(analytics.questions.accuracy).toBeNull();
    expect(analytics.sessions.focusMs).toBe(0);
  });

  it('formats durations with units', () => {
    expect(formatFocusDuration(0)).toBe('0 min');
    expect(formatFocusDuration(95 * 60000)).toBe('1 h 35 min');
  });

  it('downgrades analytics when F4 conflicts are pending and warns on tiny samples', () => {
    const oneQuestion = session({
      id: 'tiny',
      state: 'COMPLETED',
      editalIds: ['e1'],
      intervals: [interval(10)],
      measurements: [{ id: 'm-tiny', sessionId: 'tiny', questions: 1, correctAnswers: 1 }],
    });
    const analytics = buildAnalytics(
      {
        profileId: PROFILE,
        content: contentFixture(),
        scenarios: [],
        blocks: [],
        sessions: [oneQuestion],
        sessionConflicts: 1,
      },
      TODAY,
    );
    expect(analytics.status).toBe('PARTIAL');
    expect(analytics.questions.accuracy).toBe(1);
    expect(analytics.warnings.join(' ')).toContain('Amostra pequena');
    expect(analytics.warnings.join(' ')).toContain('conflito');
  });

  it('compares periods only when a previous denominator exists', () => {
    const current = buildAnalytics(
      {
        profileId: PROFILE,
        content: contentFixture(),
        scenarios: [],
        blocks: [],
        sessions: [
          session({ id: 'cur', state: 'COMPLETED', editalIds: ['e1'], intervals: [interval(60)] }),
        ],
      },
      TODAY,
    );
    const previous = buildAnalytics(
      {
        profileId: PROFILE,
        content: contentFixture(),
        scenarios: [],
        blocks: [],
        sessions: [
          session({
            id: 'prev',
            state: 'COMPLETED',
            editalIds: ['e1'],
            intervals: [interval(30)],
            recordedAtCivilDate: '2026-10-03',
          }),
        ],
      },
      '2026-10-03',
    );
    const comparison = compareAnalytics(current, previous);
    expect(comparison.previousFocusMs).toBe(30 * 60000);
    expect(comparison.focusDeltaPct).toBeCloseTo(100);

    const emptyPrevious = compareAnalytics(current, {
      ...previous,
      sessions: { ...previous.sessions, focusMs: 0, inPeriod: 0 },
    });
    expect(emptyPrevious.focusDeltaPct).toBeNull();
    expect(emptyPrevious.note).toContain('Sem período anterior');
  });
});

describe('f6 home presentation modes and indicators', () => {
  const items: PriorityItem[] = [
    {
      id: 'today',
      category: 'REVISAO_HOJE',
      title: 'Revisão hoje',
      detail: 'x',
      dueDate: TODAY,
      target: 'reviews',
      severity: 5,
    },
    {
      id: 'late-review',
      category: 'REVISAO_ATRASADA',
      title: 'Revisão atrasada',
      detail: 'x',
      dueDate: '2026-11-01',
      target: 'reviews',
      severity: 3,
    },
    {
      id: 'late-block',
      category: 'ATRASO_REAL',
      title: 'Bloco atrasado',
      detail: 'x',
      dueDate: '2026-11-01',
      target: 'planning',
      severity: 4,
    },
    {
      id: 'session',
      category: 'SESSAO_ATIVA',
      title: 'Sessão',
      detail: 'x',
      dueDate: null,
      target: 'sessions',
      severity: 0,
    },
    {
      id: 'future',
      category: 'ATIVIDADE_FUTURA',
      title: 'Futuro',
      detail: 'x',
      dueDate: '2026-11-10',
      target: 'planning',
      severity: 7,
    },
  ];

  it('reorders presentation without dropping any item', () => {
    const daily = orderPrioritiesForMode(items, 'DAILY').map((item) => item.id);
    expect(daily).toEqual(['session', 'late-review', 'late-block', 'today', 'future']);
    const finalStretch = orderPrioritiesForMode(items, 'FINAL_STRETCH').map((item) => item.id);
    expect(finalStretch.slice(0, 3)).toEqual(['session', 'late-review', 'today']);
    const performance = orderPrioritiesForMode(items, 'PERFORMANCE').map((item) => item.id);
    expect(performance.slice(0, 3)).toEqual(['session', 'late-block', 'late-review']);
    expect(new Set(daily)).toEqual(new Set(items.map((item) => item.id)));
  });

  it('keeps stable ties by due date and id', () => {
    const first = { ...items[1]!, id: 'a' };
    const second = { ...items[1]!, id: 'b' };
    expect(orderPrioritiesForMode([second, first], 'DAILY').map((item) => item.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('shows only selected indicators in catalog order', () => {
    const counts = {
      activeEditais: 2,
      subjects: 3,
      plannedToday: 4,
      completedLast7Days: 5,
      reviewsDue: 6,
    };
    const selected = selectHomeIndicators(counts, ['reviewsDue', 'activeEditais']);
    expect(selected.map((item) => item.id)).toEqual(['activeEditais', 'reviewsDue']);
    expect(selected.map((item) => item.value)).toEqual([2, 6]);
    expect(selectHomeIndicators(counts, [])).toEqual([]);
  });
});

