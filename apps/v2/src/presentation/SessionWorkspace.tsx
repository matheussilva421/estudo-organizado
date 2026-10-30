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
  const [recovery, setRecovery] = useState<RecoveryPreview | null>(null);
  const [history, setHistory] = useState<StudySession[]>([]);
  const [habits, setHabits] = useState<StudyHabit[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [busy, setBusy] = useState(false);
  const [manualDate, setManualDate] = useState(todayInZone());
  const [manualMinutes, setManualMinutes] = useState('30');
  const [manualNote, setManualNote] = useState('');

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
      setAuthority(currentAuthority);
      setRecovery(
        loaded ? await service.getRecoveryPreview(profileId, loaded.id) : null,
      );
    } else {
      setSession(null);
      setAuthority(null);
      setRecovery(null);
    }
    const page = await querySessionHistory(repository, { profileId }, undefined, 50);
    setHistory(page.items);
    setHabits(await habitService.listHabits(profileId));
  }, [coordinator, habitService, profileId, repository, service]);

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

  async function startSession(): Promise<void> {
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
        origin: 'TIMER',
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

  async function control(
    action: 'pause' | 'resume' | 'complete',
  ): Promise<void> {
    if (!session || !authority || locked || busy) return;
    setBusy(true);
    onNotice(null);
    try {
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
                disabled={locked || busy}
                data-testid="session-pause"
              >
                Pausar
              </button>
            ) : null}
            {session?.state === 'PAUSED' ? (
              <button
                type="button"
                onClick={() => control('resume')}
                disabled={locked || busy}
                data-testid="session-resume"
              >
                Retomar
              </button>
            ) : null}
            {session && session.state !== 'COMPLETED' ? (
              <button
                type="button"
                onClick={() => control('complete')}
                disabled={locked || busy}
                data-testid="session-complete"
              >
                Concluir
              </button>
            ) : null}
          </div>
          {recovery ? (
            <div data-testid="session-recovery">
              <p>Tempo confirmado: {formatMs(recovery.durableVerifiedMs)}</p>
              <button type="button" onClick={() => recover('KEEP_PENDING')}>
                Manter pendente
              </button>
              <button type="button" onClick={() => recover('COMPLETE')}>
                Concluir recuperação
              </button>
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
            Minutos
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
              {item.state} · {formatMs(item.manualDeclaredMs ?? 0)}
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
