import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ContentSnapshot } from '../application/content-service';
import {
  StudySessionService,
  type RecoveryPreview,
} from '../application/session-service';
import { LocalSessionHabitService } from '../application/session-habit-service';
import { querySessionHistory } from '../application/session-queries';
import { exportSessionHistory } from '../application/session-portability';
import { createSystemClock } from '../domain/session-clock';
import { getHabitEvidence, type StudyHabit } from '../domain/session-habits';
import type { SessionAllocation, StudySession } from '../domain/session';
import { sessionTotalFocusMs } from '../domain/session-accounting';
import type { PlanBlock } from '../domain/planning';
import type { SessionConflict } from '../domain/session-conflicts';
import { LocalSessionRepository } from '../platform/local-session-repository';
import type { SessionFactsPatch } from '../platform/local-session-repository';
import type { SessionCommitInput } from '../platform/local-session-repository';
import type { SessionAuditRecord } from '../platform/local-session-repository';
import {
  applyEmergencyImport,
  downloadEmergencyFile,
  exportUnsavedSessionIntent,
  previewEmergencyImport,
  type EmergencyPreview,
} from '../application/session-emergency';
import {
  getDatabaseUpgradeState,
  openV2Database,
  requestResult,
  STORES,
} from '../platform/indexeddb';
import { applyWaitingUpdate } from '../platform/sw-update';
import {
  LocalSessionCoordinator,
  type SessionAuthority,
} from '../platform/session-coordination';

const ZONE = 'America/Fortaleza';
const UPDATE_CHANNEL = 'estudo-organizado-v2-update';
let sessionStartInFlight = false;
let lastStartedBlockId: string | null = null;

async function queryOtherTabsReady(holderId: string): Promise<boolean> {
  if (typeof BroadcastChannel !== 'function') return false;
  const channel = new BroadcastChannel(UPDATE_CHANNEL);
  let responses = 0;
  let allReady = true;
  channel.onmessage = (event: MessageEvent) => {
    const message = event.data as {
      type?: string;
      from?: string;
      ready?: boolean;
    };
    if (message?.type === 'UPDATE_RESPONSE' && message.from !== holderId) {
      responses += 1;
      if (message.ready !== true) allReady = false;
    }
  };
  channel.postMessage({ type: 'UPDATE_QUERY', from: holderId });
  await new Promise((resolve) => setTimeout(resolve, 300));
  channel.close();
  return responses === 0 ? true : allReady;
}

type Props = {
  profileId: string;
  content: ContentSnapshot;
  locked: boolean;
  onNotice: (message: string | null) => void;
  startBlockId?: string | null;
  onStartBlockConsumed?: () => void;
};

function newId(): string {
  return crypto.randomUUID();
}

function todayInZone(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return (
    String(hours).padStart(2, '0') +
    ':' +
    String(minutes).padStart(2, '0') +
    ':' +
    String(seconds).padStart(2, '0')
  );
}

function blockLabel(block: PlanBlock, content: ContentSnapshot): string {
  const link = content.links.find((item) => item.id === block.editalDisciplineId);
  const subject = content.subjects.find((item) => item.id === link?.subjectId);
  const assunto = content.assuntos.find((item) => item.id === block.assuntoId);
  const aula = content.aulas.find((item) => item.id === block.aulaId);
  const parts = [
    subject?.title,
    assunto?.title ?? aula?.title,
    block.civilDate,
    block.plannedMinutes + ' min',
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(' · ') : block.label ?? block.id;
}

export function SessionWorkspace({
  profileId,
  content,
  locked,
  onNotice,
  startBlockId,
  onStartBlockConsumed,
}: Props) {
  const [session, setSession] = useState<StudySession | null>(null);
  const [authority, setAuthority] = useState<SessionAuthority | null>(null);
  const [foreignAuthority, setForeignAuthority] = useState<SessionAuthority | null>(null);
  const [recovery, setRecovery] = useState<RecoveryPreview | null>(null);
  const [history, setHistory] = useState<StudySession[]>([]);
  const [historyCursor, setHistoryCursor] = useState<string | undefined>(undefined);
  const [habits, setHabits] = useState<StudyHabit[]>([]);
  const [planBlocks, setPlanBlocks] = useState<PlanBlock[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [busy, setBusy] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [manualDate, setManualDate] = useState(todayInZone());
  const [manualMinutes, setManualMinutes] = useState('30');
  const [manualNote, setManualNote] = useState('');
  const [recoveryMinutes, setRecoveryMinutes] = useState('0');
  const [planBlockId, setPlanBlockId] = useState('');
  const [questions, setQuestions] = useState('0');
  const [correctAnswers, setCorrectAnswers] = useState('0');
  const [pagesFrom, setPagesFrom] = useState('');
  const [pagesTo, setPagesTo] = useState('');
  const [materialKind, setMaterialKind] = useState<
    'PDF' | 'VIDEO' | 'BOOK' | 'SITE' | 'OTHER'
  >('PDF');
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialUrl, setMaterialUrl] = useState('');
  const [materialNotes, setMaterialNotes] = useState('');
  const [allocationLinkId, setAllocationLinkId] = useState('');
  const [allocationMinutes, setAllocationMinutes] = useState('30');
  const [allocationDrafts, setAllocationDrafts] = useState<
    { linkId: string; minutes: number }[]
  >([]);
  const [emergencyRaw, setEmergencyRaw] = useState('');
  const [emergencyPreview, setEmergencyPreview] = useState<EmergencyPreview | null>(
    null,
  );
  const [revisions, setRevisions] = useState<
    Record<string, SessionAuditRecord[]>
  >({});
  const [linkDrafts, setLinkDrafts] = useState<Record<string, string>>({});
  const [persistState, setPersistState] = useState<
    'IDLE' | 'SAVED' | 'FAILED' | 'CONFLICT'
  >('IDLE');
  const [conflicts, setConflicts] = useState<SessionConflict[]>([]);
  const [habitKind, setHabitKind] = useState<'TIME' | 'QUESTIONS' | 'MANUAL'>(
    'TIME',
  );
  const [habitTarget, setHabitTarget] = useState('120');
  const [habitRecurrence, setHabitRecurrence] = useState<'DAILY' | 'WEEKLY'>(
    'DAILY',
  );
  const [pomodoroStage, setPomodoroStage] = useState<'FOCUS' | 'BREAK'>('FOCUS');
  const [pomodoroFocus, setPomodoroFocus] = useState('25');
  const [pomodoroBreak, setPomodoroBreak] = useState('5');

  const holderId = useMemo(() => newId(), []);
  const repository = useMemo(() => new LocalSessionRepository(), []);
  const coordinator = useMemo(() => new LocalSessionCoordinator(), []);
  const clock = useMemo(() => createSystemClock(holderId), [holderId]);
  const service = useMemo(
    () => new StudySessionService(repository, clock),
    [clock, repository],
  );
  const habitService = useMemo(() => new LocalSessionHabitService(), []);

  const trackPersist = useCallback(
    (outcome: { kind: string }) => {
      setPersistState(
        outcome.kind === 'LOCAL_COMMITTED'
          ? 'SAVED'
          : outcome.kind === 'CONFLICT'
            ? 'CONFLICT'
            : 'FAILED',
      );
    },
    [],
  );

  const elapsedRef = useRef(0);
  const sessionRef = useRef<StudySession | null>(null);
  const authorityRef = useRef<SessionAuthority | null>(null);
  const checkpointInFlight = useRef(false);

  useEffect(() => {
    sessionRef.current = session;
    authorityRef.current = authority;
  }, [authority, session]);

  const refresh = useCallback(async () => {
    const currentAuthority = await coordinator.getAuthority(profileId);
    if (currentAuthority) {
      const loaded = await repository.load(profileId, currentAuthority.sessionId);
      setSession(loaded);
      const isMine = currentAuthority.holderId === holderId;
      setAuthority(isMine ? currentAuthority : null);
      setForeignAuthority(isMine ? null : currentAuthority);
      setRecovery(
        loaded ? await service.getRecoveryPreview(profileId, loaded.id) : null,
      );
    } else {
      setSession(null);
      setAuthority(null);
      setForeignAuthority(null);
      setRecovery(null);
    }
    const page = await querySessionHistory(repository, { profileId }, undefined, 50);
    setHistory(page.items);
    setHistoryCursor(page.nextCursor);
    setHabits(await habitService.listHabits(profileId));
    setConflicts(await repository.listSessionConflicts(profileId));
    const database = await openV2Database(profileId);
    const blockTransaction = database.transaction(STORES.planningBlocks, 'readonly');
    setPlanBlocks(
      (await requestResult(
        blockTransaction
          .objectStore(STORES.planningBlocks)
          .index('by_profile')
          .getAll(profileId),
      )) as PlanBlock[],
    );
  }, [coordinator, habitService, holderId, profileId, repository, service]);

  async function takeOver(): Promise<void> {
    if (!foreignAuthority || locked || busy) return;
    setBusy(true);
    onNotice(null);
    try {
      const active = session;
      const last = active?.intervals[active.intervals.length - 1];
      if (active && active.state === 'RUNNING' && last) {
        // The other tab holds unpersisted time. Pause at the last durable
        // checkpoint so no unverified time is credited during the handover.
        await service.pauseSession({
          scope: { profileId, operationId: newId(), baseRevision: null },
          sessionId: active.id,
          authority: foreignAuthority,
          checkpoint: {
            intervalId: last.id,
            verifiedMs: last.verifiedMs,
            checkpoint: clock.observe(),
            endedAt: new Date().toISOString(),
          },
        });
      }
      const result = await coordinator.transferAuthority(
        foreignAuthority.sessionId,
        profileId,
        foreignAuthority.holderId,
        holderId,
        foreignAuthority.generation,
        newId(),
      );
      if (result.kind !== 'LOCAL_COMMITTED') {
        onNotice('Não foi possível assumir o controle do cronômetro.');
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh().catch(() => onNotice('Não foi possível carregar as sessões.'));
  }, [onNotice, refresh]);

  useEffect(() => {
    if (!startBlockId || startBlockId === lastStartedBlockId) return;
    const blockId = startBlockId.split('#')[0] ?? startBlockId;
    lastStartedBlockId = startBlockId;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlanBlockId(blockId);
    void startSessionWithOrigin('TIMER', blockId);
    onStartBlockConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startBlockId]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let cancelled = false;
    const check = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (!cancelled) setUpdateReady(Boolean(registration.waiting));
      } catch {
        // Service worker registration is optional in local development.
      }
    };
    void check();
    const timer = setInterval(check, 2_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel !== 'function') return;
    const channel = new BroadcastChannel(UPDATE_CHANNEL);
    channel.onmessage = (event: MessageEvent) => {
      const message = event.data as { type?: string; from?: string };
      if (message?.type === 'UPDATE_QUERY' && message.from !== holderId) {
        const ready =
          !(
            session &&
            session.state !== 'COMPLETED' &&
            session.state !== 'CANCELLED'
          ) &&
          manualNote.trim().length === 0 &&
          recovery === null;
        channel.postMessage({
          type: 'UPDATE_RESPONSE',
          from: holderId,
          ready,
        });
      }
    };
    return () => channel.close();
  }, [holderId, manualNote, recovery, session]);

  async function applyUpdate(): Promise<void> {
    if (!('serviceWorker' in navigator) || busy) return;
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const otherTabsReady = await queryOtherTabsReady(holderId);
      const result = await applyWaitingUpdate(registration, {
        hasActiveSession:
          session !== null &&
          session.state !== 'COMPLETED' &&
          session.state !== 'CANCELLED',
        hasUnsavedForm: manualNote.trim().length > 0,
        hasPendingRecovery: recovery !== null,
        databaseCompatible: !getDatabaseUpgradeState().blocked,
        otherTabsReady,
      });
      if (result === 'DEFERRED') {
        onNotice('Atualização adiada: sessão ativa, recuperação pendente ou formulário não salvo.');
      } else if (result === 'INCOMPATIBLE') {
        onNotice('Atualização incompatível com o banco atual; escrita bloqueada até recuperação.');
      } else if (result === 'APPLIED') {
        setUpdateReady(false);
        onNotice('Atualização aplicada sem recarregar a sessão.');
      } else {
        onNotice('Falha ao aplicar a atualização.');
      }
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!session || session.state !== 'RUNNING') {
      elapsedRef.current = session
        ? session.intervals
            .filter((interval) => interval.kind === 'FOCUS')
            .reduce((sum, interval) => sum + interval.verifiedMs, 0)
        : 0;
      setElapsedMs(elapsedRef.current);
      return;
    }
    const base = session.intervals
      .filter((interval) => interval.kind === 'FOCUS')
      .reduce((sum, interval) => sum + interval.verifiedMs, 0);
    const last = session.intervals[session.intervals.length - 1];
    if (!last || last.kind !== 'FOCUS') {
      // A break never advances the study clock.
      elapsedRef.current = base;
      setElapsedMs(base);
      return;
    }
    const started = performance.now();
    const update = () => {
      elapsedRef.current = base + (performance.now() - started);
      setElapsedMs(elapsedRef.current);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [session]);

  useEffect(() => {
    if (locked) return;
    const flush = async () => {
      const current = sessionRef.current;
      const currentAuthority = authorityRef.current;
      if (!current || !currentAuthority) return;
      if (current.state !== 'RUNNING' || checkpointInFlight.current) return;
      const last = current.intervals[current.intervals.length - 1];
      if (!last || last.kind !== 'FOCUS') return;
      const base = current.intervals
        .filter((interval) => interval.kind === 'FOCUS')
        .reduce((sum, interval) => sum + interval.verifiedMs, 0);
      const live = Math.max(elapsedRef.current, base);
      const verifiedMs = last.verifiedMs + (live - base);
      if (verifiedMs <= last.verifiedMs) return;
      checkpointInFlight.current = true;
      try {
        const result = await service.checkpointSession({
          scope: { profileId, operationId: newId(), baseRevision: null },
          sessionId: current.id,
          authority: currentAuthority,
          intervalId: last.id,
          verifiedMs,
          checkpoint: clock.observe(),
        });
        if (result.kind === 'LOCAL_COMMITTED') setSession(result.value);
      } catch {
        // Keep the last durable value; the next transition still commits.
      } finally {
        checkpointInFlight.current = false;
      }
    };
    const timer = setInterval(() => {
      void flush();
    }, 15_000);
    const onHide = () => {
      void flush();
    };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [clock, locked, profileId, service, session]);

  useEffect(() => {
    if (session?.origin === 'POMODORO') {
      const last = session.intervals[session.intervals.length - 1];
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPomodoroStage(last?.kind === 'BREAK' ? 'BREAK' : 'FOCUS');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.intervals.length]);

  async function startSessionWithOrigin(
    origin: 'TIMER' | 'POMODORO',
    blockIdOverride = planBlockId,
  ): Promise<void> {
    if (locked || busy || sessionStartInFlight) return;
    sessionStartInFlight = true;
    setBusy(true);
    onNotice(null);
    const sessionId = newId();
    const blockId = blockIdOverride.trim();
    let acquiredAuthority: SessionAuthority | null = null;
    let started = false;
    try {
      if (blockId) {
        const existing = (await repository.listSessions(profileId)).find(
          (item) =>
            item.planBlockIds.includes(blockId) &&
            item.state !== 'COMPLETED' &&
            item.state !== 'CANCELLED',
        );
        if (existing) {
          setPlanBlockId(blockId);
          onNotice('Já existe uma sessão ativa ou pausada para este bloco.');
          await refresh();
          return;
        }
      }
      const acquired = await coordinator.acquireAuthority(
        sessionId,
        profileId,
        holderId,
        null,
        newId(),
      );
      if (acquired.kind !== 'LOCAL_COMMITTED') {
        onNotice('Outra aba controla o cronômetro. Transfira a autoridade antes de iniciar.');
        return;
      }
      acquiredAuthority = acquired.value;
      const result = await service.startSession({
        scope: { profileId, operationId: newId(), baseRevision: null },
        sessionId,
        origin,
        authority: acquired.value,
        referenceZone: ZONE,
        recordedAtCivilDate: todayInZone(),
      });
      trackPersist(result);
      if (result.kind !== 'LOCAL_COMMITTED') {
        onNotice('Não foi possível iniciar a sessão.');
      } else {
        started = true;
        if (blockId) {
          const linked = await service.linkSessionToPlan({
            scope: {
              profileId,
              operationId: newId(),
              baseRevision: result.value.localRevision,
            },
            sessionId,
            blockIds: [blockId],
            authority: acquired.value,
          });
          if (linked.kind !== 'LOCAL_COMMITTED') {
            onNotice('Sessão criada, mas o vínculo F3 foi recusado; a sessão foi preservada.');
          }
        }
      }
      await refresh();
    } finally {
      sessionStartInFlight = false;
      if (acquiredAuthority && !started) {
        await coordinator
          .releaseAuthority(
            sessionId,
            profileId,
            holderId,
            acquiredAuthority.generation,
            newId(),
          )
          .catch(() => undefined);
      }
      setBusy(false);
    }
  }

  async function startSession(): Promise<void> {
    return startSessionWithOrigin('TIMER');
  }

  async function startPomodoro(): Promise<void> {
    await startSessionWithOrigin('POMODORO');
    setPomodoroStage('FOCUS');
  }

  async function completePomodoroStage(): Promise<void> {
    if (!session || !authority || locked || busy) return;
    setBusy(true);
    onNotice(null);
    try {
      const config = {
        focusMs: Math.max(1, Number(pomodoroFocus) || 25) * 60_000,
        breakMs: Math.max(1, Number(pomodoroBreak) || 5) * 60_000,
      };
      const focus = [...session.intervals]
        .reverse()
        .find((interval) => interval.kind === 'FOCUS');
      const focusBase = session.intervals
        .filter((interval) => interval.kind === 'FOCUS')
        .reduce((sum, interval) => sum + interval.verifiedMs, 0);
      const actualElapsed =
        pomodoroStage === 'FOCUS' && focus
          ? focus.verifiedMs + Math.max(0, elapsedMs - focusBase)
          : config.breakMs;
      const step = await service.evaluatePomodoro({
        stage: pomodoroStage,
        elapsedVerifiedMs: actualElapsed,
        config,
        continuity: 'VALID',
        authorityValid: true,
      });
      if (step.kind === 'BEGIN_BREAK') {
        const now = clock.observe();
        const intervals = session.intervals.map((interval) =>
          interval.id === focus?.id
            ? {
                ...interval,
                verifiedMs: actualElapsed,
                contextId: now.contextId,
                checkpoint: now,
                recoveryFlag: false,
                endedAt: now.wallInstant,
              }
            : interval,
        );
        intervals.push({
          id: newId(),
          kind: 'BREAK' as const,
          verifiedMs: config.breakMs,
          contextId: now.contextId,
          checkpoint: now,
          recoveryFlag: false,
          startedAt: now.wallInstant,
        });
        const result = await service.editSessionFacts({
          scope: {
            profileId,
            operationId: newId(),
            baseRevision: session.localRevision,
          },
          sessionId: session.id,
          authority,
          patch: { intervals },
          reason: 'POMODORO_BREAK',
        });
        if (result.kind === 'LOCAL_COMMITTED') setPomodoroStage('BREAK');
        else onNotice('Não foi possível registrar o descanso.');
      } else if (step.kind === 'AWAIT_FOCUS_CONFIRMATION') {
        onNotice('Descanso concluído. Confirme o próximo foco.');
      } else if (step.kind === 'RECOVERY_REQUIRED') {
        onNotice('Pomodoro requer recuperação assistida.');
      } else {
        onNotice('O estágio ainda não foi concluído.');
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function confirmNextFocus(): Promise<void> {
    if (!session || !authority || locked || busy) return;
    setBusy(true);
    try {
      const now = clock.observe();
      const intervals = [
        ...session.intervals,
        {
          id: newId(),
          kind: 'FOCUS' as const,
          verifiedMs: 0,
          contextId: now.contextId,
          checkpoint: now,
          recoveryFlag: false,
          startedAt: now.wallInstant,
        },
      ];
      const result = await service.editSessionFacts({
        scope: {
          profileId,
          operationId: newId(),
          baseRevision: session.localRevision,
        },
        sessionId: session.id,
        authority,
        patch: { intervals },
        reason: 'POMODORO_NEXT_FOCUS',
      });
      if (result.kind === 'LOCAL_COMMITTED') setPomodoroStage('FOCUS');
      else onNotice('Não foi possível iniciar o próximo foco.');
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function control(
    action: 'pause' | 'resume' | 'complete',
  ): Promise<void> {
    if (!session || !authority || locked || busy) return;
    setBusy(true);
    onNotice(null);
    try {
      let checkpoint:
        | {
            intervalId: string;
            verifiedMs: number;
            checkpoint: ReturnType<typeof clock.observe>;
            endedAt?: string;
          }
        | undefined;
      if (action === 'pause' || action === 'complete') {
        const focus = [...session.intervals]
          .reverse()
          .find((interval) => interval.kind === 'FOCUS');
        if (focus) {
          const base = session.intervals
            .filter((interval) => interval.kind === 'FOCUS')
            .reduce((sum, interval) => sum + interval.verifiedMs, 0);
          const last = session.intervals[session.intervals.length - 1];
          const delta =
            last?.kind === 'FOCUS' ? Math.max(0, elapsedMs - base) : 0;
          const observation = clock.observe();
          checkpoint = {
            intervalId: focus.id,
            verifiedMs: focus.verifiedMs + delta,
            checkpoint: observation,
            endedAt: observation.wallInstant,
          };
        }
      }
      const input = {
        scope: {
          profileId,
          operationId: newId(),
          baseRevision: session.localRevision,
        },
        sessionId: session.id,
        authority,
        checkpoint,
      };
      const result =
        action === 'pause'
          ? await service.pauseSession(input)
          : action === 'resume'
            ? await service.resumeSession(input)
            : await service.completeSession(input);
      trackPersist(result);
      if (result.kind !== 'LOCAL_COMMITTED') {
        onNotice('A transição não foi aceita. Recarregue e revise o estado.');
      } else if (action === 'complete') {
        await coordinator.releaseAuthority(
          session.id,
          profileId,
          holderId,
          authority.generation,
          newId(),
        );
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function recover(
    decision: 'RESUME' | 'COMPLETE' | 'CORRECT_MANUALLY' | 'KEEP_PENDING',
  ): Promise<void> {
    if (!session || !authority || locked || busy) return;
    setBusy(true);
    try {
      const result = await service.recoverSession({
        scope: {
          profileId,
          operationId: newId(),
          baseRevision: session.localRevision,
        },
        sessionId: session.id,
        decision,
        manualAdjustmentMs:
          decision === 'CORRECT_MANUALLY'
            ? Math.max(0, Number(recoveryMinutes) || 0) * 60_000
            : undefined,
        authority,
      });
      trackPersist(result);
      if (result.kind !== 'LOCAL_COMMITTED') {
        onNotice('A recuperação não foi aceita.');
      } else if (decision === 'COMPLETE') {
        await coordinator.releaseAuthority(
          session.id,
          profileId,
          holderId,
          authority.generation,
          newId(),
        );
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function registerManual(): Promise<void> {
    if (locked || busy) return;
    setBusy(true);
    onNotice(null);
    try {
      const sessionId = newId();
      // A manual record has no timer, so it must not compete for the
      // single timer lease held by a running or paused session.
      const result = await service.registerManualSession({
        scope: { profileId, operationId: newId(), baseRevision: null },
        sessionId,
        civilDate: manualDate,
        referenceZone: ZONE,
        durationMs: Math.max(0, Number(manualMinutes) || 0) * 60_000,
        note: manualNote.trim() || undefined,
      });
      trackPersist(result);
      if (result.kind !== 'LOCAL_COMMITTED') {
        onNotice('O registro manual foi recusado.');
      } else {
        const details: SessionFactsPatch = {};
        const questionCount = Number(questions) || 0;
        const correctCount = Number(correctAnswers) || 0;
        const from = pagesFrom ? Number(pagesFrom) : null;
        const to = pagesTo ? Number(pagesTo) : null;
        if (questionCount > 0 || from !== null || to !== null) {
          details.measurements = [
            {
              id: newId(),
              sessionId,
              questions: questionCount,
              correctAnswers: correctCount,
              ...(from !== null && to !== null
                ? { pages: { from, to } }
                : {}),
            },
          ];
        }
        if (materialTitle.trim()) {
          details.materials = [
            {
              id: newId(),
              kind: materialKind,
              title: materialTitle.trim(),
              url: materialUrl.trim() || undefined,
              notes: materialNotes.trim() || undefined,
            },
          ];
        }
        const allocations: SessionAllocation[] = allocationDrafts
          .filter((draft) => draft.linkId)
          .map((draft) => ({
            sessionId,
            allocationId: newId(),
            editalDisciplineId: draft.linkId,
            durationMs: draft.minutes * 60_000,
          }));
        if (allocations.length > 0) details.allocations = allocations;
        if (Object.keys(details).length > 0) {
          const edited = await service.editSessionFacts({
            scope: {
              profileId,
              operationId: newId(),
              baseRevision: result.value.localRevision,
            },
            sessionId,
            patch: details,
            reason: 'MANUAL_DETAILS',
          });
          if (edited.kind !== 'LOCAL_COMMITTED') {
            onNotice('Sessão manual salva; detalhes recusados. Verifique questões, páginas, materiais e alocações.');
          }
        }
        const overlaps = await service.findPotentialOverlaps(profileId, manualDate);
        if (overlaps.length > 1) {
          onNotice('Aviso: já existe outra sessão nesta data; ambos os registros foram preservados.');
        } else {
          onNotice('Sessão manual registrada.');
        }
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function createHabit(): Promise<void> {
    if (locked || busy) return;
    const numericTarget = Number(habitTarget);
    const target =
      habitKind === 'MANUAL'
        ? undefined
        : habitKind === 'TIME'
          ? Math.max(0, numericTarget) * 60_000
          : Math.max(0, numericTarget);
    if (habitKind !== 'MANUAL' && (!Number.isFinite(target) || (target ?? 0) <= 0)) {
      onNotice('Informe uma meta válida para o hábito.');
      return;
    }
    setBusy(true);
    try {
      const result = await habitService.createHabit({
        profileId,
        habitId: newId(),
        kind: habitKind,
        target,
        referenceZone: ZONE,
        recurrence: habitRecurrence,
      });
      if (result.kind !== 'LOCAL_COMMITTED') onNotice('Hábito não criado.');
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function addAllocation(): void {
    const minutes = Number(allocationMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      onNotice('Informe uma duração válida para a alocação.');
      return;
    }
    setAllocationDrafts([
      ...allocationDrafts,
      { linkId: allocationLinkId, minutes },
    ]);
  }

  async function confirmHabit(habit: StudyHabit): Promise<void> {
    if (locked || busy) return;
    setBusy(true);
    try {
      const result = await habitService.confirmHabitOccurrence({
        scope: { profileId, operationId: newId(), baseRevision: null },
        habitId: habit.id,
        civilDate: todayInZone(),
      });
      if (result.kind !== 'LOCAL_COMMITTED') onNotice('Confirmação não aceita.');
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function reconcile(
    sessionItem: StudySession,
    blockId: string,
    choice: 'CONCLUDED' | 'PARTIAL' | 'NOT_APPLIED',
  ): Promise<void> {
    if (locked || busy) return;
    setBusy(true);
    onNotice(null);
    let acquired = false;
    let effectiveAuthority = authority;
    try {
      if (!effectiveAuthority || effectiveAuthority.sessionId !== sessionItem.id) {
        const acquiredResult = await coordinator.acquireAuthority(
          sessionItem.id,
          profileId,
          holderId,
          null,
          newId(),
        );
        if (acquiredResult.kind !== 'LOCAL_COMMITTED') {
          onNotice('Conclua a sessão ativa antes de reconciliar outra sessão.');
          return;
        }
        effectiveAuthority = acquiredResult.value;
        acquired = true;
      }
      const block = planBlocks.find((item) => item.id === blockId);
      if (!block) {
        onNotice('Bloco de planejamento não encontrado.');
        return;
      }
      const result = await service.reconcilePlanProgress({
        scope: {
          profileId,
          operationId: newId(),
          baseRevision: sessionItem.localRevision,
        },
        sessionId: sessionItem.id,
        blockId,
        choice,
        planningBaseRevision: block.localRevision,
        authority: effectiveAuthority,
      });
      trackPersist(result);
      if (result.kind === 'CONFLICT') {
        onNotice('Conflito de revisão do planejamento; a sessão foi preservada.');
      } else if (result.kind === 'FAILED') {
        onNotice('Não foi possível reconciliar o bloco.');
      } else {
        onNotice('Conciliação registrada; o bloco F3 não foi concluído automaticamente.');
      }
      if (acquired) {
        await coordinator
          .releaseAuthority(
            sessionItem.id,
            profileId,
            holderId,
            effectiveAuthority.generation,
            newId(),
          )
          .catch(() => undefined);
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function exportHistory(format: 'CSV' | 'JSON'): Promise<void> {
    const allSessions = await repository.listSessions(profileId);
    const exported = exportSessionHistory(format, { profileId }, allSessions);
    const blob = new Blob([exported.content], { type: exported.mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = exported.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function exportEmergency(): Promise<void> {
    const sessionId = newId();
    const durationMs = Math.max(0, Number(manualMinutes) || 0) * 60_000;
    const command: SessionCommitInput = {
      kind: 'CREATE',
      scope: { profileId, operationId: newId(), baseRevision: null },
      sessionId,
      session: {
        id: sessionId,
        profileId,
        state: 'COMPLETED',
        origin: 'MANUAL',
        localRevision: 1,
        schemaVersion: 1,
        referenceZone: ZONE,
        recordedAtCivilDate: manualDate,
        manualDeclaredMs: durationMs,
        note: manualNote.trim() || undefined,
        planBlockIds: [],
        editalIds: [],
        intervals: [],
      },
    };
    const exported = exportUnsavedSessionIntent({
      formatVersion: 1,
      command,
    });
    const result = await downloadEmergencyFile(exported, async (content) => {
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = exported.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    });
    if (result.ok) {
      onNotice('Intenção manual exportada para recuperação emergencial.');
    } else {
      onNotice('Falha ao exportar a intenção emergencial.');
    }
  }

  async function selectEmergencyFile(
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    const raw = await file.text();
    setEmergencyRaw(raw);
    setEmergencyPreview(previewEmergencyImport(raw, profileId));
  }

  async function applyEmergency(): Promise<void> {
    if (locked || busy) return;
    if (!emergencyRaw || emergencyPreview?.kind !== 'READY') return;
    setBusy(true);
    try {
      const result = await applyEmergencyImport(repository, emergencyRaw, {
        profileId,
        operationId: newId(),
        baseRevision: null,
      });
      trackPersist(result);
      if (result.kind === 'LOCAL_COMMITTED') {
        onNotice('Importação emergencial aplicada.');
      } else {
        onNotice('Importação emergencial recusada ou em conflito.');
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function loadRevisions(sessionId: string): Promise<void> {
    const records = await service.listSessionRevisions(profileId, sessionId);
    setRevisions((current) => ({ ...current, [sessionId]: records }));
  }

  async function loadMoreHistory(): Promise<void> {
    if (!historyCursor || busy) return;
    setBusy(true);
    try {
      const page = await querySessionHistory(
        repository,
        { profileId },
        historyCursor,
        50,
      );
      setHistory((current) => [...current, ...page.items]);
      setHistoryCursor(page.nextCursor);
    } finally {
      setBusy(false);
    }
  }

  async function linkSessionToBlock(
    item: StudySession,
    blockId: string,
  ): Promise<void> {
    if (locked || busy || !blockId) return;
    setBusy(true);
    onNotice(null);
    try {
      const result = await service.linkSessionToPlan({
        scope: {
          profileId,
          operationId: newId(),
          baseRevision: item.localRevision,
        },
        sessionId: item.id,
        blockIds: [...item.planBlockIds, blockId],
        authority: session?.id === item.id ? authority ?? undefined : undefined,
      });
      trackPersist(result);
      if (result.kind !== 'LOCAL_COMMITTED') {
        onNotice('Não foi possível vincular a sessão ao bloco.');
      } else {
        onNotice('Sessão vinculada ao bloco com nova revisão.');
        setLinkDrafts((current) => ({ ...current, [item.id]: '' }));
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function resolveConflict(
    conflict: SessionConflict,
    choice: 'LOCAL' | 'INCOMING' | 'KEEP_BOTH',
  ): Promise<void> {
    if (locked || busy) return;
    setBusy(true);
    onNotice(null);
    try {
      if (choice === 'INCOMING') {
        const incoming = conflict.incoming;
        const patch: SessionFactsPatch = {};
        if (incoming.note !== undefined) patch.note = incoming.note;
        if (incoming.measurements !== undefined) {
          patch.measurements = incoming.measurements;
        }
        if (incoming.materials !== undefined) patch.materials = incoming.materials;
        if (incoming.allocations !== undefined) {
          patch.allocations = incoming.allocations;
        }
        if (incoming.manualDeclaredMs !== undefined) {
          patch.manualDeclaredMs = incoming.manualDeclaredMs;
        }
        if (incoming.recordedAtCivilDate !== undefined) {
          patch.recordedAtCivilDate = incoming.recordedAtCivilDate;
        }
        const applied = await service.editSessionFacts({
          scope: {
            profileId,
            operationId: newId(),
            baseRevision: conflict.local.localRevision,
          },
          sessionId: conflict.sessionId,
          patch,
          reason: 'CONFLICT_RESOLUTION_INCOMING',
        });
        if (applied.kind !== 'LOCAL_COMMITTED') {
          onNotice('Conflito mantido: não foi possível aplicar a versão incoming.');
          return;
        }
      }
      const resolved = await repository.resolveSessionConflict(
        profileId,
        conflict.id,
        choice,
      );
      setPersistState(resolved ? 'SAVED' : 'FAILED');
      if (!resolved) {
        onNotice('Conflito não encontrado.');
      } else if (choice === 'INCOMING') {
        onNotice('Versão incoming aplicada com nova revisão e auditoria.');
      } else if (choice === 'LOCAL') {
        onNotice('Versão local mantida; incoming preservado no registro do conflito.');
      } else {
        onNotice('Versões preservadas: local na sessão, incoming no registro do conflito.');
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="session-workspace" aria-labelledby="session-title" data-testid="session-workspace">
      <h2 id="session-title">Execução de estudo</h2>
      <p className="empty-state">
        Cronômetro, registro manual, recuperação, hábitos e histórico local.
      </p>
      <nav className="session-nav" aria-label="Seções de execução">
        <a href="#session-timer">Timer</a>
        <a href="#session-pomodoro">Pomodoro</a>
        <a href="#session-manual">Manual</a>
        <a href="#session-habits">Hábitos</a>
        <a href="#session-history">Histórico</a>
        <a href="#session-emergency">Emergência</a>
      </nav>
      <p className="session-status" data-testid="session-persistence">
        {busy
          ? 'Gravando…'
          : persistState === 'FAILED'
            ? 'Falha ao gravar: a última ação não foi confirmada.'
            : persistState === 'CONFLICT'
              ? 'Conflito de revisão: recarregue antes de decidir.'
              : persistState === 'SAVED'
                ? 'Salvo localmente.'
                : 'Persistência local ativa.'}
      </p>
      {updateReady ? (
        <div className="inline-notice" data-testid="session-update-banner" role="status">
          <p>Atualização disponível. A sessão ativa não será recarregada.</p>
          <button
            type="button"
            onClick={applyUpdate}
            disabled={locked || busy}
            data-testid="session-apply-update"
          >
            Aplicar atualização
          </button>
        </div>
      ) : null}
      <div className="session-grid">
        <article className="session-card" id="session-timer" data-testid="session-timer">
          <h3>Cronômetro</h3>
          {session ? (
            <p>
              Estado: <strong>{session.state}</strong> · {formatMs(elapsedMs)}
            </p>
          ) : (
            <p>Nenhuma sessão ativa.</p>
          )}
          {foreignAuthority ? (
            <div data-testid="session-foreign-authority">
              <p>Outra aba controla o cronômetro.</p>
              <button
                type="button"
                onClick={takeOver}
                disabled={locked || busy}
                data-testid="session-takeover"
              >
                Assumir controle
              </button>
            </div>
          ) : null}
          <div className="session-actions">
            {!session ? (
              <button
                type="button"
                onClick={startSession}
                disabled={locked || busy}
                data-testid="session-start"
              >
                Iniciar sessão
              </button>
            ) : null}
            {session?.state === 'RUNNING' ? (
              <button
                type="button"
                onClick={() => control('pause')}
                disabled={locked || busy || !authority}
                data-testid="session-pause"
              >
                Pausar
              </button>
            ) : null}
            {session?.state === 'PAUSED' ? (
              <button
                type="button"
                onClick={() => control('resume')}
                disabled={locked || busy || !authority}
                data-testid="session-resume"
              >
                Retomar
              </button>
            ) : null}
            {session && session.state !== 'COMPLETED' ? (
              <button
                type="button"
                onClick={() => control('complete')}
                disabled={locked || busy || !authority}
                data-testid="session-complete"
              >
                Concluir
              </button>
            ) : null}
          </div>
          <label>
            Bloco de planejamento
            <select
              value={planBlockId}
              onChange={(event) => setPlanBlockId(event.target.value)}
              data-testid="session-plan-block"
            >
              <option value="">Sem bloco</option>
              {planBlocks.map((block) => (
                <option key={block.id} value={block.id}>
                  {blockLabel(block, content)}
                </option>
              ))}
            </select>
          </label>
          {recovery ? (
            <div data-testid="session-recovery">
              <p>Tempo confirmado: {formatMs(recovery.durableVerifiedMs)}</p>
              <p>Lacunas incertas: {recovery.uncertainIntervals.length}</p>
              <button
                type="button"
                onClick={() => recover('KEEP_PENDING')}
                disabled={locked || busy || !authority}
                data-testid="session-recovery-keep"
              >
                Manter pendente
              </button>
              <button
                type="button"
                onClick={() => recover('RESUME')}
                disabled={locked || busy || !authority}
                data-testid="session-recovery-resume"
              >
                Retomar
              </button>
              <label>
                Correção manual (min)
                <input
                  type="number"
                  min="0"
                  value={recoveryMinutes}
                  onChange={(event) => setRecoveryMinutes(event.target.value)}
                />
              </label>
              <button
                type="button"
                onClick={() => recover('CORRECT_MANUALLY')}
                disabled={locked || busy || !authority}
                data-testid="session-recovery-correct"
              >
                Corrigir manualmente
              </button>
              <button
                type="button"
                onClick={() => recover('COMPLETE')}
                disabled={locked || busy || !authority}
                data-testid="session-recovery-complete"
              >
                Concluir recuperação
              </button>
            </div>
          ) : null}
        </article>

        <article className="session-card" id="session-pomodoro" data-testid="session-pomodoro">
          <h3>Pomodoro</h3>
          <p>
            Estágio:{' '}
            <strong>{pomodoroStage === 'FOCUS' ? 'Foco' : 'Descanso'}</strong>
          </p>
          <label>
            Foco (min)
            <input
              type="number"
              min="1"
              value={pomodoroFocus}
              onChange={(event) => setPomodoroFocus(event.target.value)}
            />
          </label>
          <label>
            Descanso (min)
            <input
              type="number"
              min="1"
              value={pomodoroBreak}
              onChange={(event) => setPomodoroBreak(event.target.value)}
            />
          </label>
          {!session ? (
            <button
              type="button"
              onClick={startPomodoro}
              disabled={locked || busy}
              data-testid="pomodoro-start"
            >
              Iniciar Pomodoro
            </button>
          ) : null}
          {session?.origin === 'POMODORO' && session.state !== 'COMPLETED' ? (
            <div className="session-actions">
              <button
                type="button"
                onClick={completePomodoroStage}
                disabled={locked || busy}
                data-testid="pomodoro-complete-stage"
              >
                {pomodoroStage === 'FOCUS' ? 'Concluir foco' : 'Concluir descanso'}
              </button>
              {pomodoroStage === 'BREAK' ? (
                <button
                  type="button"
                  onClick={confirmNextFocus}
                  disabled={locked || busy}
                  data-testid="pomodoro-next-focus"
                >
                  Confirmar novo foco
                </button>
              ) : null}
            </div>
          ) : null}
        </article>

        <article className="session-card" id="session-manual" data-testid="session-manual">
          <h3>Registro manual</h3>
          <label>
            Data
            <input
              type="date"
              value={manualDate}
              onChange={(event) => setManualDate(event.target.value)}
            />
          </label>
          <label>
            Duração da sessão (min)
            <input
              type="number"
              min="0"
              value={manualMinutes}
              onChange={(event) => setManualMinutes(event.target.value)}
            />
          </label>
          <label>
            Nota
            <input
              value={manualNote}
              onChange={(event) => setManualNote(event.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={registerManual}
            disabled={locked || busy}
            data-testid="session-manual-submit"
          >
            Registrar sessão manual
          </button>
          <details>
            <summary>Detalhes da sessão</summary>
            <label>
              Questões
              <input
                type="number"
                min="0"
                value={questions}
                onChange={(event) => setQuestions(event.target.value)}
                data-testid="session-questions"
              />
            </label>
            <label>
              Acertos
              <input
                type="number"
                min="0"
                value={correctAnswers}
                onChange={(event) => setCorrectAnswers(event.target.value)}
                data-testid="session-correct"
              />
            </label>
            <label>
              Páginas de
              <input
                type="number"
                min="1"
                value={pagesFrom}
                onChange={(event) => setPagesFrom(event.target.value)}
                data-testid="session-pages-from"
              />
            </label>
            <label>
              Páginas até
              <input
                type="number"
                min="1"
                value={pagesTo}
                onChange={(event) => setPagesTo(event.target.value)}
                data-testid="session-pages-to"
              />
            </label>
            <label>
              Material
              <select
                value={materialKind}
                onChange={(event) =>
                  setMaterialKind(
                    event.target.value as
                      | 'PDF'
                      | 'VIDEO'
                      | 'BOOK'
                      | 'SITE'
                      | 'OTHER',
                  )
                }
                data-testid="session-material-kind"
              >
                <option value="PDF">PDF</option>
                <option value="VIDEO">Vídeo</option>
                <option value="BOOK">Livro</option>
                <option value="SITE">Site</option>
                <option value="OTHER">Outro</option>
              </select>
            </label>
            <label>
              Título do material
              <input
                value={materialTitle}
                onChange={(event) => setMaterialTitle(event.target.value)}
                data-testid="session-material-title"
              />
            </label>
            <label>
              URL do material
              <input
                value={materialUrl}
                onChange={(event) => setMaterialUrl(event.target.value)}
                data-testid="session-material-url"
              />
            </label>
            <label>
              Comentários do material
              <input
                value={materialNotes}
                onChange={(event) => setMaterialNotes(event.target.value)}
                data-testid="session-material-notes"
              />
            </label>
            <label>
              Distribuir para
              <select
                value={allocationLinkId}
                onChange={(event) => setAllocationLinkId(event.target.value)}
                data-testid="session-allocation-link"
              >
                <option value="">Parcela não atribuída</option>
                {content.links.map((link) => {
                  const subject = content.subjects.find(
                    (item) => item.id === link.subjectId,
                  );
                  return (
                    <option key={link.id} value={link.id}>
                      {subject?.title ?? link.displayAlias ?? link.id}
                    </option>
                  );
                })}
              </select>
            </label>
            <label>
              Duração da alocação (min)
              <input
                type="number"
                min="1"
                value={allocationMinutes}
                onChange={(event) => setAllocationMinutes(event.target.value)}
                data-testid="session-allocation-minutes"
              />
            </label>
            <button
              type="button"
              onClick={addAllocation}
              data-testid="session-allocation-add"
            >
              Adicionar alocação
            </button>
            <p data-testid="session-allocation-summary">
              Alocado:{' '}
              {formatMs(
                allocationDrafts.reduce(
                  (sum, draft) => sum + draft.minutes * 60_000,
                  0,
                ),
              )}{' '}
              · Não atribuído:{' '}
              {formatMs(
                Math.max(
                  0,
                  Math.max(0, Number(manualMinutes) || 0) * 60_000 -
                    allocationDrafts.reduce(
                      (sum, draft) => sum + draft.minutes * 60_000,
                      0,
                    ),
                ),
              )}
            </p>
          </details>
        </article>

        <article className="session-card" id="session-habits" data-testid="session-habits">
          <h3>Hábitos</h3>
          <label>
            Categoria do hábito
            <select
              value={habitKind}
              onChange={(event) =>
                setHabitKind(
                  event.target.value as 'TIME' | 'QUESTIONS' | 'MANUAL',
                )
              }
              data-testid="session-habit-kind"
            >
              <option value="TIME">Tempo de estudo</option>
              <option value="QUESTIONS">Questões</option>
              <option value="MANUAL">Manual</option>
            </select>
          </label>
          <label>
            {habitKind === 'TIME'
              ? 'Meta (min)'
              : habitKind === 'QUESTIONS'
                ? 'Meta (questões)'
                : 'Meta'}
            <input
              type="number"
              min="1"
              value={habitTarget}
              disabled={habitKind === 'MANUAL'}
              onChange={(event) => setHabitTarget(event.target.value)}
              data-testid="session-habit-target"
            />
          </label>
          <label>
            Recorrência
            <select
              value={habitRecurrence}
              onChange={(event) =>
                setHabitRecurrence(event.target.value as 'DAILY' | 'WEEKLY')
              }
              data-testid="session-habit-recurrence"
            >
              <option value="DAILY">Diário</option>
              <option value="WEEKLY">Semanal</option>
            </select>
          </label>
          <button
            type="button"
            onClick={createHabit}
            disabled={locked || busy}
            data-testid="session-habit-create"
          >
            Criar hábito
          </button>
          <ul>
            {habits.map((habit) => {
              const evidence = getHabitEvidence(habit, history, todayInZone());
              const targetLabel =
                habit.kind === 'TIME'
                  ? formatMs(habit.target ?? 0)
                  : habit.kind === 'QUESTIONS'
                    ? String(habit.target ?? 0) + ' questões'
                    : 'manual';
              const progressLabel =
                habit.kind === 'QUESTIONS'
                  ? String(evidence.progress) + ' questões'
                  : formatMs(evidence.progress);
              return (
                <li key={habit.id}>
                  {habit.kind} · meta {targetLabel} · progresso {progressLabel}
                  <button type="button" onClick={() => confirmHabit(habit)}>
                    Confirmar hoje
                  </button>
                </li>
              );
            })}
          </ul>
        </article>
      </div>

      <article className="session-card" id="session-history" data-testid="session-history">
        <h3>Histórico</h3>
        <div className="session-actions">
          <button type="button" onClick={() => exportHistory('CSV')} data-testid="session-export-csv">
            Exportar CSV
          </button>
          <button type="button" onClick={() => exportHistory('JSON')} data-testid="session-export-json">
            Exportar JSON
          </button>
        </div>
        {history.length === 0 ? (
          <p className="empty-state">
            Nenhuma sessão registrada ainda. Inicie o cronômetro ou registre manualmente.
          </p>
        ) : (
          <ul>
            {history.map((item) => (
              <li
                key={item.id}
                data-session-id={item.id}
                data-block-ids={item.planBlockIds.join(',')}
              >
                <div>
                  {item.recordedAtCivilDate ?? 'sem data'} · {item.origin} ·{' '}
                  {item.state} ·{' '}
                  {formatMs(sessionTotalFocusMs(item))}
                </div>
                {item.planBlockIds.length === 0 && planBlocks.length > 0 ? (
                  <div className="session-actions">
                    <select
                      aria-label={'Bloco para vincular a sessão ' + item.id}
                      data-testid={'session-link-block-' + item.id}
                      value={linkDrafts[item.id] ?? ''}
                      disabled={locked || busy}
                      onChange={(event) =>
                        setLinkDrafts((current) => ({
                          ...current,
                          [item.id]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Vincular a um bloco…</option>
                      {planBlocks.map((block) => (
                        <option key={block.id} value={block.id}>
                          {blockLabel(block, content)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={locked || busy || !(linkDrafts[item.id] ?? '')}
                      data-testid={'session-link-apply-' + item.id}
                      onClick={() =>
                        void linkSessionToBlock(item, linkDrafts[item.id] ?? '')
                      }
                    >
                      Vincular
                    </button>
                  </div>
                ) : null}
                {item.planBlockIds.length > 0 ? (
                  <div className="session-actions">
                    {item.planBlockIds.map((blockId) => {
                      const block = planBlocks.find(
                        (candidate) => candidate.id === blockId,
                      );
                      const disabled =
                        locked ||
                        busy ||
                        Boolean(session && session.id !== item.id);
                      return (
                        <span key={blockId}>
                          <span>
                            {block ? blockLabel(block, content) : 'Bloco vinculado'}
                          </span>
                          <button
                            type="button"
                            disabled={disabled}
                            data-testid={'session-reconcile-' + blockId + '-concluded'}
                            onClick={() => reconcile(item, blockId, 'CONCLUDED')}
                          >
                            Concluído
                          </button>
                          <button
                            type="button"
                            disabled={disabled}
                            data-testid={'session-reconcile-' + blockId + '-partial'}
                            onClick={() => reconcile(item, blockId, 'PARTIAL')}
                          >
                            Parcial
                          </button>
                          <button
                            type="button"
                            disabled={disabled}
                            data-testid={'session-reconcile-' + blockId + '-not-applied'}
                            onClick={() => reconcile(item, blockId, 'NOT_APPLIED')}
                          >
                            Não aplicado
                          </button>
                        </span>
                      );
                    })}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => void loadRevisions(item.id)}
                  data-testid={'session-revisions-' + item.id}
                >
                  Revisões
                </button>
                {revisions[item.id] ? (
                  revisions[item.id]!.length === 0 ? (
                    <p className="hint">Sem revisões registradas.</p>
                  ) : (
                    <ul>
                      {revisions[item.id]!.map((revision) => (
                        <li key={revision.id}>
                          rev {revision.baseRevision}→{revision.newRevision} ·{' '}
                          {revision.mutationKind} · {revision.source}
                          {revision.reason ? ' · ' + revision.reason : ''}
                        </li>
                      ))}
                    </ul>
                  )
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {historyCursor ? (
          <button
            type="button"
            onClick={() => void loadMoreHistory()}
            disabled={busy}
            data-testid="session-history-more"
          >
            Carregar mais
          </button>
        ) : null}
      </article>

      <article className="session-card" id="session-conflicts" data-testid="session-conflicts">
        <h3>Conflitos</h3>
        {conflicts.filter((conflict) => conflict.status !== 'RESOLVED').length === 0 ? (
          <p className="hint">Nenhum conflito pendente.</p>
        ) : (
          <ul>
            {conflicts
              .filter((conflict) => conflict.status !== 'RESOLVED')
              .map((conflict) => (
                <li key={conflict.id}>
                  Sessão {conflict.sessionId} · {conflict.kind} · local{' '}
                  {formatMs(conflict.local.manualDeclaredMs ?? 0)} · incoming{' '}
                  {formatMs(conflict.incoming.manualDeclaredMs ?? 0)}
                  <div className="session-actions">
                    <button
                      type="button"
                      onClick={() => resolveConflict(conflict, 'LOCAL')}
                      disabled={locked || busy}
                    >
                      Manter local
                    </button>
                    <button
                      type="button"
                      onClick={() => resolveConflict(conflict, 'INCOMING')}
                      disabled={locked || busy}
                    >
                      Usar incoming
                    </button>
                    <button
                      type="button"
                      onClick={() => resolveConflict(conflict, 'KEEP_BOTH')}
                      disabled={locked || busy}
                    >
                      Manter ambos
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </article>

      <article className="session-card" id="session-emergency" data-testid="session-emergency">
        <h3>Emergência</h3>
        <p className="empty-state">
          Exporte a intenção manual não salva ou reimporte um arquivo validado.
        </p>
        <div className="session-actions">
          <button
            type="button"
            onClick={exportEmergency}
            data-testid="session-emergency-export"
          >
            Exportar intenção manual
          </button>
          <label>
            Arquivo de emergência
            <input
              type="file"
              accept="application/json"
              onChange={selectEmergencyFile}
              data-testid="session-emergency-file"
            />
          </label>
        </div>
        {emergencyPreview ? (
          <p data-testid="session-emergency-preview">
            {emergencyPreview.kind}
            {emergencyPreview.reason ? ' — ' + emergencyPreview.reason : ''}
          </p>
        ) : null}
        <button
          type="button"
          onClick={applyEmergency}
          disabled={emergencyPreview?.kind !== 'READY' || busy || locked}
          data-testid="session-emergency-apply"
        >
          Aplicar importação
        </button>
      </article>
    </section>
  );
}
