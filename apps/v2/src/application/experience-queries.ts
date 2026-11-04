import type { ContentSnapshot } from './content-service';
import type { ReviewReminderSummary } from './review-service';
import type { ReviewCommitment } from '../domain/review';
import type { PlanBlock, PlanningScenario } from '../domain/planning';
import type { StudySession } from '../domain/session';
import { sessionTotalFocusMs } from '../domain/session-accounting';
import { addCivilDays } from '../domain/planning-time';
import { displayName } from '../domain/edital';

/**
 * F6 compose-only projections. Nothing here writes, ranks academic facts or
 * invents values: every number is derived from F2-F5 records and carries the
 * scope, period and validity needed to read it honestly.
 */

export type SearchResultKind =
  | 'edital'
  | 'disciplina'
  | 'assunto'
  | 'aula'
  | 'planejamento'
  | 'bloco'
  | 'sessao'
  | 'revisao';

export type SearchTarget = 'content' | 'planning' | 'sessions' | 'reviews';

export type SearchResult = {
  id: string;
  kind: SearchResultKind;
  title: string;
  context: string;
  editalId: string | null;
  target: SearchTarget;
  score: number;
};

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreMatch(title: string, context: string, needle: string): number {
  const normalizedTitle = normalizeSearchText(title);
  const normalizedContext = normalizeSearchText(context);
  if (normalizedTitle === needle) return 120;
  if (normalizedTitle.startsWith(needle)) return 100;
  if (normalizedTitle.split(' ').some((word) => word.startsWith(needle))) return 80;
  if (normalizedTitle.includes(needle)) return 60;
  if (normalizedContext.startsWith(needle)) return 40;
  if (normalizedContext.includes(needle)) return 20;
  return 0;
}

const KIND_RANK: Record<SearchResultKind, number> = {
  edital: 0,
  disciplina: 1,
  assunto: 2,
  aula: 3,
  planejamento: 4,
  bloco: 5,
  sessao: 6,
  revisao: 7,
};

/**
 * Local, offline search over committed F2 records. It never touches the DOM,
 * so results outside the currently rendered tree are found. Text stays text:
 * the caller renders it through React escaping.
 */
export function searchContent(
  content: ContentSnapshot,
  rawQuery: string,
  profileId: string,
  limit = 24,
): SearchResult[] {
  const needle = normalizeSearchText(rawQuery);
  if (needle.length < 2) return [];

  const editalById = new Map(content.editais.map((edital) => [edital.id, edital]));
  const subjectById = new Map(content.subjects.map((subject) => [subject.id, subject]));
  const linkById = new Map(content.links.map((link) => [link.id, link]));
  const results: SearchResult[] = [];

  for (const edital of content.editais) {
    if (edital.profileId !== profileId) continue;
    const score = scoreMatch(edital.title, '', needle);
    if (score > 0) {
      results.push({
        id: edital.id,
        kind: 'edital',
        title: edital.title,
        context: edital.status === 'ARCHIVED' ? 'Edital arquivado' : 'Edital ativo',
        editalId: edital.id,
        target: 'content',
        score,
      });
    }
  }

  for (const link of content.links) {
    if (link.status !== 'ACTIVE') continue;
    if (link.profileId !== profileId) continue;
    const edital = editalById.get(link.editalId);
    const subject = subjectById.get(link.subjectId);
    if (!edital || edital.profileId !== profileId || !subject || subject.profileId !== profileId) {
      continue;
    }
    const label = displayName(subject, link);
    const score = scoreMatch(label, edital.title, needle);
    if (score > 0) {
      results.push({
        id: link.id,
        kind: 'disciplina',
        title: label,
        context: edital.title,
        editalId: edital.id,
        target: 'content',
        score,
      });
    }
  }

  for (const assunto of content.assuntos) {
    if (assunto.profileId !== profileId) continue;
    const link = linkById.get(assunto.editalDisciplineId);
    const edital = link ? editalById.get(link.editalId) : undefined;
    const subject = link ? subjectById.get(link.subjectId) : undefined;
    if (!link || !edital || edital.profileId !== profileId || !subject) continue;
    const discipline = displayName(subject, link);
    const context = `${edital.title} \u00b7 ${discipline}`;
    const score = scoreMatch(assunto.title, context, needle);
    if (score > 0) {
      results.push({
        id: assunto.id,
        kind: 'assunto',
        title: assunto.title,
        context,
        editalId: edital.id,
        target: 'content',
        score,
      });
    }
  }

  for (const aula of content.aulas) {
    if (aula.profileId !== profileId) continue;
    const link = linkById.get(aula.editalDisciplineId);
    const edital = link ? editalById.get(link.editalId) : undefined;
    const subject = link ? subjectById.get(link.subjectId) : undefined;
    if (!link || !edital || edital.profileId !== profileId || !subject) continue;
    const discipline = displayName(subject, link);
    const context = `${edital.title} \u00b7 ${discipline}`;
    const score = scoreMatch(aula.title, context, needle);
    if (score > 0) {
      results.push({
        id: aula.id,
        kind: 'aula',
        title: aula.title,
        context,
        editalId: edital.id,
        target: 'content',
        score,
      });
    }
  }

  return rankSearchResults(results, limit);
}

function rankSearchResults(results: SearchResult[], limit = 24): SearchResult[] {
  return results
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      const rank = KIND_RANK[left.kind] - KIND_RANK[right.kind];
      if (rank !== 0) return rank;
      const title = left.title.localeCompare(right.title, 'pt-BR');
      if (title !== 0) return title;
      return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    })
    .slice(0, Math.max(1, Math.min(limit, 50)));
}

export type ExperienceSearchInput = {
  content: ContentSnapshot;
  scenarios: PlanningScenario[];
  blocks: PlanBlock[];
  sessions: StudySession[];
  commitments: ReviewCommitment[];
};

/**
 * Search across F2-F5 records held in this profile. It uses identity and
 * committed fields only; no DOM, no remote index and no markup execution.
 */
export function searchExperience(
  input: ExperienceSearchInput,
  rawQuery: string,
  profileId: string,
  limit = 30,
): SearchResult[] {
  const needle = normalizeSearchText(rawQuery);
  if (needle.length < 2) return [];
  const results = searchContent(input.content, rawQuery, profileId, 40);
  const editalById = new Map(input.content.editais.map((edital) => [edital.id, edital]));

  for (const scenario of input.scenarios) {
    if (scenario.profileId !== profileId) continue;
    const edital = editalById.get(scenario.editalId);
    const context = [edital?.title ?? 'Edital removido', scenario.status].join(' · ');
    const score = scoreMatch(scenario.name, context, needle);
    if (score > 0) {
      results.push({
        id: scenario.id,
        kind: 'planejamento',
        title: scenario.name,
        context,
        editalId: edital?.id ?? null,
        target: 'planning',
        score,
      });
    }
  }

  for (const block of input.blocks) {
    if (block.profileId !== profileId) continue;
    const edital = editalById.get(block.editalId);
    const date = block.civilDate ?? 'sem data';
    const title = block.label ?? 'Bloco de estudo';
    const context = [edital?.title ?? 'Edital removido', date, block.plannedMinutes + ' min'].join(
      ' · ',
    );
    const score = scoreMatch(title, context, needle);
    if (score > 0) {
      results.push({
        id: block.id,
        kind: 'bloco',
        title,
        context,
        editalId: edital?.id ?? null,
        target: 'planning',
        score,
      });
    }
  }

  for (const session of input.sessions) {
    if (session.profileId !== profileId || session.tombstone) continue;
    const date = session.recordedAtCivilDate ?? 'sem data';
    const title = 'Sessão de ' + date;
    const editais = session.editalIds
      .map((id) => editalById.get(id)?.title)
      .filter((value): value is string => Boolean(value));
    const context = [session.state, session.origin, ...editais].join(' · ');
    const score = scoreMatch(title, context, needle);
    if (score > 0) {
      results.push({
        id: session.id,
        kind: 'sessao',
        title,
        context,
        editalId: session.editalIds.length === 1 ? session.editalIds[0] ?? null : null,
        target: 'sessions',
        score,
      });
    }
  }

  for (const commitment of input.commitments) {
    if (commitment.profileId !== profileId) continue;
    const edital = editalById.get(commitment.editalId);
    const context = [
      'Revisão',
      'vence ' + commitment.currentDueDate,
      commitment.status,
      edital?.title ?? 'Edital removido',
    ].join(' · ');
    const score = scoreMatch(commitment.label, context, needle);
    if (score > 0) {
      results.push({
        id: commitment.id,
        kind: 'revisao',
        title: commitment.label,
        context,
        editalId: edital?.id ?? null,
        target: 'reviews',
        score,
      });
    }
  }

  return rankSearchResults(results, limit);
}

export type PriorityCategory =
  | 'SESSAO_ATIVA'
  | 'INTEGRIDADE'
  | 'DIAGNOSTICO'
  | 'REVISAO_ATRASADA'
  | 'ATRASO_REAL'
  | 'REVISAO_HOJE'
  | 'COMPROMISSO_PLANEJADO'
  | 'ATIVIDADE_FUTURA'
  | 'ORIENTACAO';

export type PriorityTarget =
  | 'sessions'
  | 'reviews'
  | 'planning'
  | 'content'
  | 'attention'
  | 'settings';

export type PriorityItem = {
  id: string;
  category: PriorityCategory;
  title: string;
  detail: string;
  dueDate: string | null;
  target: PriorityTarget;
  severity: number;
};

export type HomeSummary = {
  activeSession: StudySession | null;
  nextAction: PriorityItem | null;
  priorities: PriorityItem[];
  counts: {
    activeEditais: number;
    subjects: number;
    plannedToday: number;
    completedLast7Days: number;
    reviewsDue: number;
  };
  empty: boolean;
  source: string;
};

export type HomeInput = {
  profileId: string;
  content: ContentSnapshot;
  scenarios: PlanningScenario[];
  blocks: PlanBlock[];
  sessions: StudySession[];
  reminders: ReviewReminderSummary | null;
  pendingOutbox: number;
  upgradeBlocked: boolean;
  sessionConflicts?: number;
  partialReconciliation?: number;
  dataError?: boolean;
};

function sessionLabel(session: StudySession): string {
  return session.origin === 'TIMER'
    ? 'cron\u00f4metro'
    : session.origin === 'POMODORO'
      ? 'pomodoro'
      : 'registro manual';
}

export function buildHomeSummary(input: HomeInput, today: string): HomeSummary {
  const profileSessions = input.sessions.filter(
    (session) => session.profileId === input.profileId && !session.tombstone,
  );
  const activeSession =
    profileSessions.find((session) => session.state === 'RUNNING') ??
    profileSessions.find((session) => session.state === 'PAUSED') ??
    null;

  const completed = profileSessions.filter((session) => session.state === 'COMPLETED');
  const completedBlockIds = new Set(
    completed.flatMap((session) => session.planBlockIds ?? []),
  );
  const since = addCivilDays(today, -6);
  const completedLast7Days = completed.filter(
    (session) =>
      typeof session.recordedAtCivilDate === 'string' &&
      session.recordedAtCivilDate >= since &&
      session.recordedAtCivilDate <= today,
  ).length;

  const activeScenarioIds = new Set(
    input.scenarios
      .filter((scenario) => scenario.profileId === input.profileId && scenario.status === 'ACTIVE')
      .map((scenario) => scenario.id),
  );
  const activeBlocks = input.blocks.filter(
    (block) => block.profileId === input.profileId && activeScenarioIds.has(block.scenarioId),
  );
  const todayBlocks = activeBlocks.filter((block) => block.civilDate === today);
  const lateBlocks = activeBlocks
    .filter(
      (block) =>
        typeof block.civilDate === 'string' &&
        block.civilDate < today &&
        !completedBlockIds.has(block.id),
    )
    .sort((left, right) => (left.civilDate ?? '').localeCompare(right.civilDate ?? ''));
  const upcomingBlocks = activeBlocks
    .filter(
      (block) =>
        typeof block.civilDate === 'string' &&
        block.civilDate > today &&
        block.civilDate <= addCivilDays(today, 7),
    )
    .sort((left, right) => (left.civilDate ?? '').localeCompare(right.civilDate ?? ''));

  const priorities: PriorityItem[] = [];
  const push = (item: PriorityItem) => priorities.push(item);

  if (input.dataError) {
    push({
      id: 'integrity-read-error',
      category: 'INTEGRIDADE',
      title: 'Falha ao ler os dados locais',
      detail:
        'Erro de leitura não é ausência de dados. Nenhum zero ou onboarding foi inferido; tente novamente.',
      dueDate: null,
      target: 'attention',
      severity: 1.5,
    });
  }

  if (activeSession) {
    push({
      id: `session-${activeSession.id}`,
      category: 'SESSAO_ATIVA',
      title: activeSession.state === 'RUNNING' ? 'Sess\u00e3o em andamento' : 'Sess\u00e3o pausada',
      detail: `Registro por ${sessionLabel(activeSession)}. O cron\u00f4metro continua no m\u00f3dulo Sess\u00f5es.`,
      dueDate: activeSession.recordedAtCivilDate ?? null,
      target: 'sessions',
      severity: 0,
    });
  }

  if (input.upgradeBlocked) {
    push({
      id: 'integrity-upgrade',
      category: 'INTEGRIDADE',
      title: 'Banco local bloqueado por outra aba',
      detail: 'As edi\u00e7\u00f5es ficam bloqueadas at\u00e9 a outra aba liberar a atualiza\u00e7\u00e3o. Nada foi apagado.',
      dueDate: null,
      target: 'settings',
      severity: 1,
    });
  }

  if (input.pendingOutbox > 0) {
    push({
      id: 'integrity-outbox',
      category: 'DIAGNOSTICO',
      title: `${input.pendingOutbox} opera\u00e7\u00e3o(\u00f5es) aguardando envio remoto`,
      detail: 'Diagn\u00f3stico: o commit local est\u00e1 confirmado; envio remoto e converg\u00eancia n\u00e3o est\u00e3o comprovados nesta fase. Isto n\u00e3o substitui a pr\u00f3xima a\u00e7\u00e3o acad\u00eamica.',
      dueDate: null,
      target: 'attention',
      severity: 6.5,
    });
  }

  if ((input.sessionConflicts ?? 0) > 0) {
    push({
      id: 'integrity-session-conflicts',
      category: 'INTEGRIDADE',
      title: String(input.sessionConflicts) + ' conflito(s) de sessão F4',
      detail:
        'Existem versões divergentes preservadas; uma decisão explícita é necessária antes de conciliar.',
      dueDate: null,
      target: 'sessions',
      severity: 1.8,
    });
  }

  if ((input.partialReconciliation ?? 0) > 0) {
    push({
      id: 'integrity-partial-incoming',
      category: 'DIAGNOSTICO',
      title: 'Sess\u00e3o importada parcialmente (campos locais preservados)',
      detail:
        'Os fatos importados foram aplicados, mas intervalos e v\u00ednculos locais continuam preservados. A concilia\u00e7\u00e3o integral n\u00e3o est\u00e1 comprovada; revise antes de tratar como consolidado.',
      dueDate: null,
      target: 'sessions',
      severity: 6.6,
    });
  }

  const overdue = input.reminders?.overdue ?? [];
  const dueToday = input.reminders?.dueToday ?? [];
  const upcomingReviews = input.reminders?.upcoming ?? [];
  for (const commitment of overdue.slice(0, 6)) {
    push({
      id: `review-overdue-${commitment.id}`,
      category: 'REVISAO_ATRASADA',
      title: `Revis\u00e3o atrasada: ${commitment.label}`,
      detail: `Venceu em ${commitment.currentDueDate}. D\u00edvida de revis\u00e3o real, n\u00e3o sugest\u00e3o.`,
      dueDate: commitment.currentDueDate,
      target: 'reviews',
      severity: 3,
    });
  }

  for (const block of lateBlocks.slice(0, 6)) {
    push({
      id: `block-late-${block.id}`,
      category: 'ATRASO_REAL',
      title: `Compromisso sem sess\u00e3o: ${block.label ?? 'bloco planejado'}`,
      detail: `Planejado para ${block.civilDate} (${block.plannedMinutes} min) e sem sess\u00e3o conclu\u00edda vinculada.`,
      dueDate: block.civilDate ?? null,
      target: 'planning',
      severity: 4,
    });
  }

  for (const commitment of dueToday.slice(0, 6)) {
    push({
      id: `review-today-${commitment.id}`,
      category: 'REVISAO_HOJE',
      title: `Revis\u00e3o para hoje: ${commitment.label}`,
      detail: 'Compromisso confirmado no F5; concluir a revis\u00e3o \u00e9 uma a\u00e7\u00e3o expl\u00edcita.',
      dueDate: commitment.currentDueDate,
      target: 'reviews',
      severity: 5,
    });
  }

  for (const block of todayBlocks.slice(0, 6)) {
    push({
      id: `block-today-${block.id}`,
      category: 'COMPROMISSO_PLANEJADO',
      title: `Hoje: ${block.label ?? 'bloco planejado'}`,
      detail: `${block.plannedMinutes} min previstos. Planejado n\u00e3o significa executado.`,
      dueDate: block.civilDate ?? null,
      target: 'planning',
      severity: 6,
    });
  }

  for (const commitment of upcomingReviews.slice(0, 5)) {
    push({
      id: `review-upcoming-${commitment.id}`,
      category: 'ATIVIDADE_FUTURA',
      title: `Pr\u00f3xima revis\u00e3o: ${commitment.label}`,
      detail: `Programada para ${commitment.currentDueDate}.`,
      dueDate: commitment.currentDueDate,
      target: 'reviews',
      severity: 7,
    });
  }

  for (const block of upcomingBlocks.slice(0, 4)) {
    push({
      id: `block-upcoming-${block.id}`,
      category: 'ATIVIDADE_FUTURA',
      title: `Planejado: ${block.label ?? 'bloco de estudo'}`,
      detail: `${block.civilDate} \u00b7 ${block.plannedMinutes} min.`,
      dueDate: block.civilDate ?? null,
      target: 'planning',
      severity: 8,
    });
  }

  const activeEditais = input.content.editais.filter(
    (edital) => edital.profileId === input.profileId && edital.status === 'ACTIVE',
  );
  const empty =
    !input.dataError &&
    input.content.editais.filter((edital) => edital.profileId === input.profileId).length === 0 &&
    profileSessions.length === 0 &&
    input.blocks.filter((block) => block.profileId === input.profileId).length === 0;

  if (empty) {
    push({
      id: 'onboarding-first-edital',
      category: 'ORIENTACAO',
      title: 'Comece pelo primeiro edital',
      detail: 'Cadastre um edital e vincule disciplinas. Nenhum dado de exemplo foi criado automaticamente.',
      dueDate: null,
      target: 'content',
      severity: 9,
    });
  } else if (activeEditais.length > 0 && activeScenarioIds.size === 0) {
    push({
      id: 'onboarding-first-plan',
      category: 'ORIENTACAO',
      title: 'Crie um planejamento para o edital ativo',
      detail: 'Voc\u00ea j\u00e1 tem conte\u00fado. O planejamento ainda n\u00e3o existe; nada foi gerado automaticamente.',
      dueDate: null,
      target: 'planning',
      severity: 9,
    });
  } else if (activeScenarioIds.size > 0 && completed.length === 0) {
    push({
      id: 'onboarding-first-session',
      category: 'ORIENTACAO',
      title: 'Registre a primeira sess\u00e3o de estudo',
      detail: 'O plano est\u00e1 pronto. Inicie ou registre uma sess\u00e3o para produzir fatos reais.',
      dueDate: null,
      target: 'sessions',
      severity: 9,
    });
  }

  priorities.sort((left, right) => {
    if (left.severity !== right.severity) return left.severity - right.severity;
    const due = (left.dueDate ?? '').localeCompare(right.dueDate ?? '');
    if (due !== 0) return due;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });

  return {
    activeSession,
    nextAction: priorities[0] ?? null,
    priorities,
    counts: {
      activeEditais: activeEditais.length,
      subjects: input.content.subjects.length,
      plannedToday: todayBlocks.length,
      completedLast7Days,
      reviewsDue: overdue.length + dueToday.length,
    },
    empty,
    source: 'Derivado localmente de F2-F5 no IndexedDB deste perfil.',
  };
}

export type AnalyticsStatus = 'READY' | 'INSUFFICIENT_DATA' | 'PARTIAL';

export type AnalyticsBucket = {
  id: string;
  label: string;
  focusMs: number;
  sessions: number;
};

export type AnalyticsSummary = {
  status: AnalyticsStatus;
  profileId: string;
  period: { from: string; to: string };
  scope: string;
  source: string;
  sessions: {
    completed: number;
    inPeriod: number;
    undated: number;
    recovery: number;
    focusMs: number;
    manualMs: number;
  };
  questions: {
    total: number;
    correct: number;
    accuracy: number | null;
    sessionsWithData: number;
  };
  planned: { blocks: number; minutes: number; activeScenarios: number };
  byEdital: AnalyticsBucket[];
  byDiscipline: AnalyticsBucket[];
  byDay: AnalyticsBucket[];
  sharedSessions: number;
  unassignedSessions: number;
  warnings: string[];
  fingerprint?: string;
};

export type AnalyticsInput = {
  profileId: string;
  content: ContentSnapshot;
  scenarios: PlanningScenario[];
  blocks: PlanBlock[];
  sessions: StudySession[];
  sessionConflicts?: number;
  partialIncoming?: number;
};

export function buildAnalytics(
  input: AnalyticsInput,
  today: string,
  days = 30,
): AnalyticsSummary {
  const from = addCivilDays(today, -(Math.max(1, days) - 1));
  const completed = input.sessions.filter(
    (session) =>
      session.profileId === input.profileId &&
      session.state === 'COMPLETED' &&
      !session.tombstone,
  );
  const dated = completed.filter(
    (session) => typeof session.recordedAtCivilDate === 'string',
  );
  const undated = completed.length - dated.length;
  const inPeriod = dated.filter(
    (session) =>
      (session.recordedAtCivilDate ?? '') >= from &&
      (session.recordedAtCivilDate ?? '') <= today,
  );
  const recovery = inPeriod.filter((session) =>
    session.intervals.some((interval) => interval.recoveryFlag),
  ).length;
  const sessionConflicts = input.sessionConflicts ?? 0;
  const partialIncoming = input.partialIncoming ?? 0;

  let focusMs = 0;
  let manualMs = 0;
  let questionTotal = 0;
  let correctTotal = 0;
  let sessionsWithData = 0;
  let sharedSessions = 0;
  let unassignedSessions = 0;

  const byEdital = new Map<string, AnalyticsBucket>();
  const byDiscipline = new Map<string, AnalyticsBucket>();
  const byDay = new Map<string, AnalyticsBucket>();
  const editalById = new Map(input.content.editais.map((edital) => [edital.id, edital]));
  const subjectById = new Map(input.content.subjects.map((subject) => [subject.id, subject]));
  const linkById = new Map(input.content.links.map((link) => [link.id, link]));

  for (const session of inPeriod) {
    const total = sessionTotalFocusMs(session);
    focusMs += total;
    manualMs += session.manualDeclaredMs ?? 0;

    if (session.measurements && session.measurements.length > 0) {
      sessionsWithData += 1;
      for (const measurement of session.measurements) {
        questionTotal += measurement.questions;
        correctTotal += measurement.correctAnswers;
      }
    }

    const editais = session.editalIds ?? [];
    if (editais.length === 1) {
      const editalId = editais[0] ?? '';
      const current = byEdital.get(editalId) ?? {
        id: editalId,
        label: editalById.get(editalId)?.title ?? 'Edital removido',
        focusMs: 0,
        sessions: 0,
      };
      current.focusMs += total;
      current.sessions += 1;
      byEdital.set(editalId, current);
    } else if (editais.length > 1) {
      sharedSessions += 1;
    } else {
      unassignedSessions += 1;
    }

    for (const allocation of session.allocations ?? []) {
      const key = allocation.editalDisciplineId ?? '';
      if (!key) continue;
      const link = linkById.get(key);
      const subject = link ? subjectById.get(link.subjectId) : undefined;
      const current = byDiscipline.get(key) ?? {
        id: key,
        label: link && subject ? displayName(subject, link) : 'Disciplina removida',
        focusMs: 0,
        sessions: 0,
      };
      current.focusMs += allocation.durationMs;
      current.sessions += 1;
      byDiscipline.set(key, current);
    }

    const civilDate = session.recordedAtCivilDate ?? '';
    if (civilDate) {
      const day = byDay.get(civilDate) ?? {
        id: civilDate,
        label: civilDate,
        focusMs: 0,
        sessions: 0,
      };
      day.focusMs += total;
      day.sessions += 1;
      byDay.set(civilDate, day);
    }
  }

  const activeScenarios = input.scenarios.filter(
    (scenario) => scenario.profileId === input.profileId && scenario.status === 'ACTIVE',
  );
  const activeScenarioIds = new Set(activeScenarios.map((scenario) => scenario.id));
  const plannedBlocks = input.blocks.filter(
    (block) =>
      block.profileId === input.profileId &&
      activeScenarioIds.has(block.scenarioId) &&
      typeof block.civilDate === 'string' &&
      block.civilDate >= from &&
      block.civilDate <= today,
  );
  const plannedMinutes = plannedBlocks.reduce((sum, block) => sum + block.plannedMinutes, 0);

  const warnings: string[] = [];
  if (undated > 0) {
    warnings.push(`${undated} sess\u00e3o(\u00f5es) sem data civil n\u00e3o entram no per\u00edodo.`);
  }
  if (sharedSessions > 0) {
    warnings.push(
      `${sharedSessions} sess\u00e3o(\u00f5es) vinculada(s) a mais de um edital ficam fora dos subtotais por edital; eles n\u00e3o s\u00e3o aditivos.`,
    );
  }
  if (recovery > 0) {
    warnings.push(`${recovery} sess\u00e3o(\u00f5es) cont\u00e9m intervalos recuperados; dados parciais.`);
  }
  if (manualMs > 0) {
    warnings.push(`Inclui ${Math.round(manualMs / 60000)} min de corre\u00e7\u00e3o manual declarada.`);
  }
  if (unassignedSessions > 0) {
    warnings.push(`${unassignedSessions} sess\u00e3o(\u00f5es) sem edital vinculado permanecem fora dos subtotais por edital.`);
  }
  if (sessionConflicts > 0) {
    warnings.push(
      String(sessionConflicts) +
        ' conflito(s) de sessão F4 pendente(s); a conciliação integral não está comprovada.',
    );
  }
  if (partialIncoming > 0) {
    warnings.push(
      String(partialIncoming) +
        ' sess\u00e3o(\u00f5es) importada(s) parcialmente: campos locais preservados; os indicadores s\u00e3o diagn\u00f3sticos.',
    );
  }
  const lowSample = questionTotal > 0 && questionTotal < 10;
  if (lowSample) {
    warnings.push(
      'Amostra pequena: ' +
        String(questionTotal) +
        ' questão(ões). O aproveitamento não deve ser lido como tendência.',
    );
  }

  const status: AnalyticsStatus =
    inPeriod.length === 0
      ? 'INSUFFICIENT_DATA'
      : undated > 0 || recovery > 0 || sessionConflicts > 0 || partialIncoming > 0
        ? 'PARTIAL'
        : 'READY';

  const sortBuckets = (buckets: Map<string, AnalyticsBucket>) =>
    [...buckets.values()].sort((left, right) => {
      if (right.focusMs !== left.focusMs) return right.focusMs - left.focusMs;
      return left.label.localeCompare(right.label, 'pt-BR');
    });

  return {
    status,
    profileId: input.profileId,
    period: { from, to: today },
    scope: 'Todos os editais do perfil local',
    source: 'Sess\u00f5es F4 e planos F3 persistidos no IndexedDB; nenhum valor remoto.',
    sessions: {
      completed: completed.length,
      inPeriod: inPeriod.length,
      undated,
      recovery,
      focusMs,
      manualMs,
    },
    questions: {
      total: questionTotal,
      correct: correctTotal,
      accuracy: questionTotal > 0 ? correctTotal / questionTotal : null,
      sessionsWithData,
    },
    planned: {
      blocks: plannedBlocks.length,
      minutes: plannedMinutes,
      activeScenarios: activeScenarios.length,
    },
    byEdital: sortBuckets(byEdital),
    byDiscipline: sortBuckets(byDiscipline),
    byDay: [...byDay.values()].sort((left, right) => left.id.localeCompare(right.id)),
    sharedSessions,
    unassignedSessions,
    warnings,
  };
}

export function formatFocusDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${String(minutes).padStart(2, '0')} min`;
}

export type AnalyticsComparison = {
  previousFocusMs: number;
  previousSessions: number;
  focusDeltaPct: number | null;
  note: string;
};

/** Comparison never invents a baseline: no previous focus means no delta. */
export function compareAnalytics(
  current: AnalyticsSummary,
  previous: AnalyticsSummary,
): AnalyticsComparison {
  const previousFocusMs = previous.sessions.focusMs;
  const focusDeltaPct =
    previousFocusMs > 0
      ? ((current.sessions.focusMs - previousFocusMs) / previousFocusMs) * 100
      : null;
  return {
    previousFocusMs,
    previousSessions: previous.sessions.inPeriod,
    focusDeltaPct,
    note:
      focusDeltaPct === null
        ? 'Sem período anterior comparável; nenhuma variação percentual foi calculada.'
        : 'Variação sobre o mesmo escopo e janela imediatamente anterior.',
  };
}

export type HomeMode = 'DAILY' | 'FINAL_STRETCH' | 'PERFORMANCE';

export const HOME_MODE_OPTIONS: Array<{ id: HomeMode; label: string; description: string }> = [
  {
    id: 'DAILY',
    label: 'Rotina diária',
    description: 'Ordem padrão: sessão e integridade primeiro, depois o dia.',
  },
  {
    id: 'FINAL_STRETCH',
    label: 'Reta final',
    description: 'Revisões vencidas e de hoje sobem; o restante continua visível.',
  },
  {
    id: 'PERFORMANCE',
    label: 'Acompanhamento',
    description: 'Execução e integridade sobem; compromissos permanecem acessíveis.',
  },
];

const MODE_WEIGHT: Record<HomeMode, Record<PriorityCategory, number>> = {
  DAILY: {
    SESSAO_ATIVA: 0,
    INTEGRIDADE: 1,
    REVISAO_ATRASADA: 2,
    ATRASO_REAL: 3,
    REVISAO_HOJE: 4,
    COMPROMISSO_PLANEJADO: 5,
    DIAGNOSTICO: 6,
    ATIVIDADE_FUTURA: 7,
    ORIENTACAO: 8,
  },
  FINAL_STRETCH: {
    SESSAO_ATIVA: 0,
    INTEGRIDADE: 1,
    REVISAO_ATRASADA: 2,
    REVISAO_HOJE: 3,
    ATRASO_REAL: 4,
    COMPROMISSO_PLANEJADO: 5,
    DIAGNOSTICO: 6,
    ATIVIDADE_FUTURA: 7,
    ORIENTACAO: 8,
  },
  PERFORMANCE: {
    SESSAO_ATIVA: 0,
    INTEGRIDADE: 1,
    ATRASO_REAL: 2,
    REVISAO_ATRASADA: 3,
    COMPROMISSO_PLANEJADO: 4,
    REVISAO_HOJE: 5,
    DIAGNOSTICO: 6,
    ATIVIDADE_FUTURA: 7,
    ORIENTACAO: 8,
  },
};

/**
 * Presentation-only ordering. Every item stays in the list; the mode cannot
 * hide a session, an integrity warning, an overdue review or a real delay.
 */
export function orderPrioritiesForMode(
  items: readonly PriorityItem[],
  mode: HomeMode,
): PriorityItem[] {
  const weights = MODE_WEIGHT[mode] ?? MODE_WEIGHT.DAILY;
  return [...items].sort((left, right) => {
    const weight = weights[left.category] - weights[right.category];
    if (weight !== 0) return weight;
    const due = (left.dueDate ?? '').localeCompare(right.dueDate ?? '');
    if (due !== 0) return due;
    return left.id.localeCompare(right.id);
  });
}

export type HomeIndicatorId =
  | 'activeEditais'
  | 'subjects'
  | 'plannedToday'
  | 'completedLast7Days'
  | 'reviewsDue';

export const HOME_INDICATORS: Array<{ id: HomeIndicatorId; label: string }> = [
  { id: 'activeEditais', label: 'Editais ativos' },
  { id: 'subjects', label: 'Disciplinas' },
  { id: 'plannedToday', label: 'Blocos planejados hoje' },
  { id: 'completedLast7Days', label: 'Sessões concluídas (7 dias)' },
  { id: 'reviewsDue', label: 'Revisões vencidas/hoje' },
];

export const DEFAULT_HOME_INDICATORS: HomeIndicatorId[] = HOME_INDICATORS.map(
  (indicator) => indicator.id,
);

export function selectHomeIndicators(
  counts: HomeSummary['counts'],
  visible: readonly HomeIndicatorId[],
): Array<{ id: HomeIndicatorId; label: string; value: number }> {
  return HOME_INDICATORS.filter((indicator) => visible.includes(indicator.id)).map(
    (indicator) => ({
      id: indicator.id,
      label: indicator.label,
      value: counts[indicator.id],
    }),
  );
}
