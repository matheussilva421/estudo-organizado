import { useCallback, useEffect, useState } from 'react';
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
import { canSubmitTitle, initialFormState, markSubmitFailure, THEMES, type FormState } from './ui-state';

const PROFILE_ID = 'local-default';

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
  const [content, setContent] = useState<ContentSnapshot>(EMPTY_SNAPSHOT);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [form, setForm] = useState<FormState>(initialFormState);
  const [notice, setNotice] = useState<string | null>(null);
  const [theme, setTheme] = useState('grafite');
  const [ready, setReady] = useState(false);
  const [selectedEditalId, setSelectedEditalId] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [upgrade, setUpgrade] = useState<DatabaseUpgradeState>(getDatabaseUpgradeState());

  const contentRepository = useCallback(
    () => new LocalContentRepository({ fault: getE2EFault() }),
    [],
  );
  const profileRepository = useCallback(() => new LocalProfileRepository(), []);

  const refresh = useCallback(async () => {
    const [snapshot, record, outbox] = await Promise.all([
      contentRepository().loadContent(PROFILE_ID),
      profileRepository().getProfile(PROFILE_ID),
      getPendingOutbox(PROFILE_ID),
    ]);
    setContent(snapshot);
    setProfile(record);
    setPending(outbox.length);
    setSelectedEditalId((current) => {
      if (current && snapshot.editais.some((edital) => edital.id === current)) return current;
      const firstActive = snapshot.editais.find((edital) => edital.status === 'ACTIVE');
      return firstActive?.id ?? null;
    });
    setReady(true);
  }, [contentRepository, profileRepository]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh().catch((error) => setNotice(persistenceMessage(error)));
    return subscribeLocalChanges(PROFILE_ID, () => {
      refresh().catch(() => undefined);
    });
  }, [refresh]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => subscribeDatabaseUpgrade(setUpgrade), []);

  const apply = useCallback(
    async (run: () => Promise<CommitResult<unknown>>, success: string) => {
      setNotice(null);
      try {
        const result = await run();
        setNotice(resultMessage(result, success));
        await refresh();
        return result;
      } catch (error) {
        setNotice(persistenceMessage(error));
        return { kind: 'FAILED', reason: 'UNKNOWN' } as CommitResult<unknown>;
      }
    },
    [refresh],
  );

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
      });
      await refresh();
    } catch (error) {
      setNotice(persistenceMessage(error));
      throw error;
    }
  }

  const selected = content.editais.find((edital) => edital.id === selectedEditalId) ?? null;
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

  return (
    <main
      className="app-shell"
      data-db-ready={ready ? 'true' : 'false'}
      data-db-upgrade={upgrade.kind}
      data-execution={EXECUTION_DATA_STATE}
    >
      <header className="app-header">
        <div>
          <h1>Estudo Organizado V2</h1>
          <p className="app-subtitle">Editais, disciplinas e aulas locais, sem login obrigatório.</p>
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

      <p className="execution-state" data-state={EXECUTION_DATA_STATE}>
        Progresso de estudo: <strong>{EXECUTION_DATA_STATE}</strong> — as sessões chegam na fase F4;
        nada é estimado aqui.
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
          onTitleChange={(title) => setForm({ ...form, title, error: null })}
          onSubmit={createSubject}
          locked={upgrade.blocked}
        />
        {notice ? (
          <p className="inline-notice" role="alert">
            {notice}
          </p>
        ) : null}
        <SubjectList subjects={content.subjects} onRename={renameSubject} ready={ready} />
      </section>

      <EditalManager
        editais={content.editais}
        primaryEditalId={profile?.primaryEditalId ?? null}
        subjects={content.subjects}
        selectedId={selectedEditalId}
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
          ).then(() => undefined)
        }
        onRename={(edital, title) =>
          apply(
            () =>
              contentRepository().execute({
                type: 'RENAME_EDITAL',
                operationId: newId(),
                profileId: PROFILE_ID,
                editalId: edital.id,
                title,
              }),
            'Tente novamente.',
          ).then(() => undefined)
        }
        onArchive={(edital, replacement) =>
          apply(
            () =>
              profileRepository().archiveEdital({
                profileId: PROFILE_ID,
                editalId: edital.id,
                operationId: newId(),
                replacementPrimaryId: replacement,
              }),
            'Tente novamente.',
          ).then(() => undefined)
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
          ).then(() => undefined)
        }
        onSetPrimary={(editalId) =>
          apply(
            () =>
              profileRepository().setPrimaryEdital({
                profileId: PROFILE_ID,
                editalId,
                operationId: newId(),
              }),
            'Tente novamente.',
          ).then(() => undefined)
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
          ).then(() => undefined)
        }
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
              ).then(() => undefined)
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
              ).then(() => undefined)
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
              ).then(() => undefined)
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
              ).then(() => undefined)
            }
          />
        ) : (
          <p className="empty-state">Selecione ou crie um edital para verticalizar o conteúdo.</p>
        )}
      </section>

      <ImportPreview
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

      <p className="app-footnote">
        Os dados ficam no IndexedDB isolado desta origem. Nenhuma sincronização real é executada
        nesta fase.
      </p>
    </main>
  );
}
