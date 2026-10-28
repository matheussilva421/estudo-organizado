import { useCallback, useEffect, useState } from 'react';
import type { StudySubject } from '../domain/subject';
import type { SyncHealth } from '../application/sync-types';
import { assessSyncHealth } from '../application/sync-policy';
import { getPendingOutbox, LocalPersistenceError } from '../platform/indexeddb';
import { LocalSubjectRepository } from '../platform/local-subject-repository';
import { subscribeLocalChanges } from '../platform/local-events';
import { getE2EFault } from '../platform/e2e-fault';
import { SubjectForm } from './components/SubjectForm';
import { SubjectList } from './components/SubjectList';
import { SyncStatus } from './components/SyncStatus';
import {
  canSubmitTitle,
  initialFormState,
  markSubmitFailure,
  THEMES,
  type FormState,
} from './ui-state';

const PROFILE_ID = 'local-default';

function repository(): LocalSubjectRepository {
  return new LocalSubjectRepository({ fault: getE2EFault() });
}

function newId(): string {
  return crypto.randomUUID();
}

function persistenceMessage(error: unknown): string {
  if (error instanceof LocalPersistenceError) {
    if (error.kind === 'QUOTA') return 'Espaço insuficiente neste navegador. O texto foi preservado.';
    if (error.kind === 'ABORT') return 'Gravação interrompida. O texto foi preservado; tente novamente.';
  }
  return 'Não foi possível salvar neste dispositivo. O texto foi preservado.';
}

export function App() {
  const [subjects, setSubjects] = useState<StudySubject[]>([]);
  const [form, setForm] = useState<FormState>(initialFormState);
  const [notice, setNotice] = useState<string | null>(null);
  const [theme, setTheme] = useState('grafite');
  const [ready, setReady] = useState(false);
  const [health, setHealth] = useState<SyncHealth>({
    localCommitted: false,
    remoteCommitted: false,
    converged: false,
    pendingCount: 0,
    mode: 'LOCAL_ONLY',
  });

  const refresh = useCallback(async () => {
    const [list, pending] = await Promise.all([
      repository().list(PROFILE_ID),
      getPendingOutbox(PROFILE_ID),
    ]);
    setSubjects(list);
    setHealth(
      assessSyncHealth({
        localCommitted: list.length > 0,
        remoteCommitted: false,
        verifiedCursor: null,
        pendingCount: pending.length,
        mode: 'LOCAL_ONLY',
      }),
    );
    setReady(true);
  }, []);

  useEffect(() => {
    // Initial hydration from the external IndexedDB source; subsequent updates
    // arrive through subscribeLocalChanges rather than cascading renders.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh().catch((error) => setNotice(persistenceMessage(error)));
    return subscribeLocalChanges(PROFILE_ID, () => {
      refresh().catch(() => undefined);
    });
  }, [refresh]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  async function createSubject(): Promise<void> {
    if (!canSubmitTitle(form.title)) {
      setForm({ ...form, error: 'Informe um nome de disciplina.' });
      return;
    }
    setForm({ ...form, submitting: true, error: null });
    setNotice(null);
    try {
      await repository().execute({
        operationId: newId(),
        profileId: PROFILE_ID,
        subjectId: newId(),
        type: 'create',
        title: form.title,
      });
      setForm(initialFormState);
      await refresh();
    } catch (error) {
      setForm(markSubmitFailure(form, persistenceMessage(error)));
    }
  }

  async function renameSubject(subject: StudySubject, title: string): Promise<void> {
    setNotice(null);
    try {
      await repository().execute({
        operationId: newId(),
        profileId: PROFILE_ID,
        subjectId: subject.id,
        type: 'rename',
        title,
      });
      await refresh();
    } catch (error) {
      setNotice(persistenceMessage(error));
      throw error;
    }
  }

  return (
    <main className="app-shell" data-db-ready={ready ? 'true' : 'false'}>
      <header className="app-header">
        <div>
          <h1>Estudo Organizado V2</h1>
          <p className="app-subtitle">Disciplinas locais, sem login obrigatório.</p>
        </div>
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

      <SyncStatus health={health} />

      <section className="panel" aria-labelledby="subjects-title">
        <h2 id="subjects-title">Disciplinas</h2>
        <SubjectForm
          form={form}
          onTitleChange={(title) => setForm({ ...form, title, error: null })}
          onSubmit={createSubject}
        />
        {notice ? (
          <p className="inline-notice" role="alert">
            {notice}
          </p>
        ) : null}
        <SubjectList subjects={subjects} onRename={renameSubject} />
      </section>

      <p className="app-footnote">
        Os dados ficam no IndexedDB isolado desta origem. Nenhuma sincronização real é executada nesta fase.
      </p>
    </main>
  );
}

