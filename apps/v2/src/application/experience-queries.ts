import type { ContentSnapshot } from './content-service';
import type { ReviewReminderSummary } from './review-service';
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

export type SearchResultKind = 'edital' | 'disciplina' | 'assunto' | 'aula';

export type SearchResult = {
  id: string;
  kind: SearchResultKind;
  title: string;
  context: string;
  editalId: string | null;
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
        score,
      });
    }
  }

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

export type PriorityCategory =
  | 'SESSAO_ATIVA'
  | 'INTEGRIDADE'
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
      category: 'INTEGRIDADE',
      title: `${input.pendingOutbox} opera\u00e7\u00e3o(\u00f5es) aguardando envio remoto`,
      detail: 'O commit local est\u00e1 confirmado; envio remoto e converg\u00eancia n\u00e3o est\u00e3o comprovados nesta fase.',
      dueDate: null,
      target: 'attention',
      severity: 2,
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

  const activeEditais = input.content.editais.filter((edital) => edital.status === 'ACTIVE');
  const empty =
    input.content.editais.length === 0 &&
    profileSessions.length === 0 &&
    input.blocks.length === 0;

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
  sharedSessions: number;
  unassignedSessions: number;
  warnings: string[];
};

export type AnalyticsInput = {
  profileId: string;
  content: ContentSnapshot;
  scenarios: PlanningScenario[];
  blocks: PlanBlock[];
  sessions: StudySession[];
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

  let focusMs = 0;
  let manualMs = 0;
  let questionTotal = 0;
  let correctTotal = 0;
  let sessionsWithData = 0;
  let sharedSessions = 0;
  let unassignedSessions = 0;

  const byEdital = new Map<string, AnalyticsBucket>();
  const byDiscipline = new Map<string, AnalyticsBucket>();
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

  const status: AnalyticsStatus =
    inPeriod.length === 0 ? 'INSUFFICIENT_DATA' : undated > 0 || recovery > 0 ? 'PARTIAL' : 'READY';

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
