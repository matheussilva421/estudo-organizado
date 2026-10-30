import { useCallback, useEffect, useMemo, useState } from 'react';
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
import type { StudySession } from '../domain/session';
import { LocalSessionRepository } from '../platform/local-session-repository';
import {
  LocalSessionCoordinator,
  type SessionAuthority,
} from '../platform/session-coordination';

const ZONE = 'America/Fortaleza';

type Props = {
  profileId: string;
  content: ContentSnapshot;
  locked: boolean;
  onNotice: (message: string | null) => void;
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

export function SessionWorkspace({ profileId, locked, onNotice }: Props) {
  const [session, setSession] = useState<StudySession | null>(null);
  const [authority, setAuthority] = useState<SessionAuthority | null>(null);
  const [foreignAuthority, setForeignAuthority] = useState<SessionAuthority | null>(null);
  const [recovery, setRecovery] = useState<RecoveryPreview | null>(null);
  const [history, setHistory] = useState<StudySession[]>([]);
  const [habits, setHabits] = useState<StudyHabit[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [busy, setBusy] = useState(false);
  const [manualDate, setManualDate] = useState(todayInZone());
  const [manualMinutes, setManualMinutes] = useState('30');
  const [manualNote, setManualNote] = useState('');
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
    setHabits(await habitService.listHabits(profileId));
  }, [coordinator, habitService, holderId, profileId, repository, service]);

  async function takeOver(): Promise<void> {
    if (!foreignAuthority || locked || busy) return;
    setBusy(true);
    onNotice(null);
    try {
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
    if (!session || session.state !== 'RUNNING') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setElapsedMs(
        session
          ? session.intervals
              .filter((interval) => interval.kind === 'FOCUS')
              .reduce((sum, interval) => sum + interval.verifiedMs, 0)
          : 0,
      );
      return;
    }
    const base = session.intervals
      .filter((interval) => interval.kind === 'FOCUS')
      .reduce((sum, interval) => sum + interval.verifiedMs, 0);
    const started = performance.now();
    const timer = setInterval(() => {
      setElapsedMs(base + (performance.now() - started));
    }, 1000);
    return () => clearInterval(timer);
  }, [session]);

  useEffect(() => {
    if (session?.origin === 'POMODORO') {
      const last = session.intervals[session.intervals.length - 1];
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPomodoroStage(last?.kind === 'BREAK' ? 'BREAK' : 'FOCUS');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.intervals.length]);

  async function startSessionWithOrigin(origin: 'TIMER' | 'POMODORO'): Promise<void> {
    if (locked || busy) return;
    setBusy(true);
    onNotice(null);
    try {
      const sessionId = newId();
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
      const result = await service.startSession({
        scope: { profileId, operationId: newId(), baseRevision: null },
        sessionId,
        origin,
        authority: acquired.value,
        referenceZone: ZONE,
        recordedAtCivilDate: todayInZone(),
      });
      if (result.kind !== 'LOCAL_COMMITTED') {
        onNotice('Não foi possível iniciar a sessão.');
      }
      await refresh();
    } finally {
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
      const step = await service.evaluatePomodoro({
        stage: pomodoroStage,
        elapsedVerifiedMs:
          pomodoroStage === 'FOCUS' ? config.focusMs : config.breakMs,
        config,
        continuity: 'VALID',
        authorityValid: true,
      });
      if (step.kind === 'BEGIN_BREAK') {
        let baseSession = session;
        if (pomodoroStage === 'FOCUS') {
          const focus = [...session.intervals]
            .reverse()
            .find((interval) => interval.kind === 'FOCUS');
          if (focus) {
            const checkpoint = await service.checkpointSession({
              scope: {
                profileId,
                operationId: newId(),
                baseRevision: session.localRevision,
              },
              sessionId: session.id,
              authority,
              intervalId: focus.id,
              verifiedMs: config.focusMs,
              checkpoint: clock.observe(),
            });
            if (checkpoint.kind !== 'LOCAL_COMMITTED') {
              onNotice('Não foi possível confirmar o foco do Pomodoro.');
              return;
            }
            baseSession = checkpoint.value;
          }
        }
        const now = clock.observe();
        const intervals = [
          ...baseSession.intervals,
          {
            id: newId(),
            kind: 'BREAK' as const,
            verifiedMs: config.breakMs,
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
            baseRevision: baseSession.localRevision,
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
      if (action === 'pause' || action === 'complete') {
        const focus = [...session.intervals]
          .reverse()
          .find((interval) => interval.kind === 'FOCUS');
        if (focus) {
          const base = session.intervals
            .filter((interval) => interval.kind === 'FOCUS')
            .reduce((sum, interval) => sum + interval.verifiedMs, 0);
          const verifiedMs = focus.verifiedMs + Math.max(0, elapsedMs - base);
          const checkpoint = await service.checkpointSession({
            scope: {
              profileId,
              operationId: newId(),
              baseRevision: session.localRevision,
            },
            sessionId: session.id,
            authority,
            intervalId: focus.id,
            verifiedMs,
            checkpoint: clock.observe(),
          });
          if (checkpoint.kind !== 'LOCAL_COMMITTED') {
            onNotice('Não foi possível confirmar o tempo medido; a transição foi cancelada.');
            return;
          }
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
      };
      const result =
        action === 'pause'
          ? await service.pauseSession(input)
          : action === 'resume'
            ? await service.resumeSession(input)
            : await service.completeSession(input);
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
          decision === 'CORRECT_MANUALLY' ? 3 * 60_000 : undefined,
        authority,
      });
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
      const acquired = await coordinator.acquireAuthority(
        sessionId,
        profileId,
        holderId,
        null,
        newId(),
      );
      if (acquired.kind !== 'LOCAL_COMMITTED') {
        onNotice('Não foi possível reservar a autoridade para o registro manual.');
        return;
      }
      const result = await service.registerManualSession({
        scope: { profileId, operationId: newId(), baseRevision: null },
        sessionId,
        civilDate: manualDate,
        referenceZone: ZONE,
        durationMs: Math.max(0, Number(manualMinutes) || 0) * 60_000,
        note: manualNote.trim() || undefined,
        authority: acquired.value,
      });
      if (result.kind !== 'LOCAL_COMMITTED') {
        onNotice('O registro manual foi recusado.');
      }
      await coordinator.releaseAuthority(
        sessionId,
        profileId,
        holderId,
        acquired.value.generation,
        newId(),
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function createHabit(): Promise<void> {
    if (locked || busy) return;
    setBusy(true);
    try {
      const result = await habitService.createHabit({
        profileId,
        habitId: newId(),
        kind: 'TIME',
        target: 2 * 60 * 60_000,
        referenceZone: ZONE,
        recurrence: 'DAILY',
      });
      if (result.kind !== 'LOCAL_COMMITTED') onNotice('Hábito não criado.');
      await refresh();
    } finally {
      setBusy(false);
    }
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

  function exportHistory(format: 'CSV' | 'JSON'): void {
    const exported = exportSessionHistory(format, { profileId }, history);
    const blob = new Blob([exported.content], { type: exported.mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = exported.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="panel" aria-labelledby="session-title" data-testid="session-workspace">
      <h2 id="session-title">Execução de estudo</h2>
      <p className="empty-state">
        Cronômetro, registro manual, recuperação, hábitos e histórico local.
      </p>
      <div className="session-grid">
        <article className="panel" data-testid="session-timer">
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
          {recovery ? (
            <div data-testid="session-recovery">
              <p>Tempo confirmado: {formatMs(recovery.durableVerifiedMs)}</p>
              <button
                type="button"
                onClick={() => recover('KEEP_PENDING')}
                disabled={locked || busy || !authority}
              >
                Manter pendente
              </button>
              <button
                type="button"
                onClick={() => recover('COMPLETE')}
                disabled={locked || busy || !authority}
              >
                Concluir recuperação
              </button>
            </div>
          ) : null}
        </article>

        <article className="panel" data-testid="session-pomodoro">
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

        <article className="panel" data-testid="session-manual">
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
        </article>

        <article className="panel" data-testid="session-habits">
          <h3>Hábitos</h3>
          <button type="button" onClick={createHabit} disabled={locked || busy}>
            Criar hábito diário de 2h
          </button>
          <ul>
            {habits.map((habit) => {
              const evidence = getHabitEvidence(habit, history, todayInZone());
              return (
                <li key={habit.id}>
                  {habit.kind} · meta {formatMs(habit.target ?? 0)} · progresso{' '}
                  {formatMs(evidence.progress)}
                  <button type="button" onClick={() => confirmHabit(habit)}>
                    Confirmar hoje
                  </button>
                </li>
              );
            })}
          </ul>
        </article>
      </div>

      <article className="panel" data-testid="session-history">
        <h3>Histórico</h3>
        <div className="session-actions">
          <button type="button" onClick={() => exportHistory('CSV')} data-testid="session-export-csv">
            Exportar CSV
          </button>
          <button type="button" onClick={() => exportHistory('JSON')} data-testid="session-export-json">
            Exportar JSON
          </button>
        </div>
        <ul>
          {history.map((item) => (
            <li key={item.id}>
              {item.recordedAtCivilDate ?? 'sem data'} · {item.origin} ·{' '}
              {item.state} ·{' '}
              {formatMs(
                item.manualDeclaredMs ??
                  item.intervals
                    .filter((interval) => interval.kind === 'FOCUS')
                    .reduce((sum, interval) => sum + interval.verifiedMs, 0),
              )}
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
