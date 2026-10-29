import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ContentSnapshot } from '../application/content-service';
import type { DraftBlockField, PlanningDraft } from '../application/planning-service';
import { applyPlanningDraft, previewDraftCommit } from '../application/planning-service';
import {
  exportPlanningScenarios,
  parsePlanningImport,
  previewPlanningImport,
} from '../application/planning-portability';
import { queryCalendar, type CalendarDay } from '../application/planning-queries';
import { advanceCycle, createCycleState, type CycleDecision } from '../domain/planning-cycle';
import { generatePlanPreview, previewRedistribution } from '../domain/planning-generator';
import {
  closeFinalStretch,
  previewExamDateChange,
  previewFinalStretchTransition,
  type ExamDateChange,
} from '../domain/planning-final-stretch';
import type { MergeConflict } from '../domain/planning-merge';
import { previewCompensation, type PlanningCheckpointRecord } from '../domain/planning-history';
import type { PlanBlock, PlanningScenario } from '../domain/planning';
import { selectOfficialReservations, type WeeklyAvailability } from '../domain/planning-capacity';
import { LocalPlanningRepository } from '../platform/local-planning-repository';
import { LocalPlanningImportCommitter } from '../platform/planning-import-commit';
import { PlanningDashboard } from './components/PlanningDashboard';
import { PlanningWizard, type WizardInput } from './components/PlanningWizard';
import { PlanningCalendar, type CalendarView } from './components/PlanningCalendar';
import { StudyCycle } from './components/StudyCycle';
import { FinalStretch } from './components/FinalStretch';
import { PlanningEditor } from './components/PlanningEditor';
import { PlanningHistory } from './components/PlanningHistory';
import { PlanningConflicts } from './components/PlanningConflicts';
import { PlanningPortability } from './components/PlanningPortability';

const ZONE = 'America/Fortaleza';

const weekly: WeeklyAvailability = {
  timeZone: ZONE,
  days: {
    MON: [{ start: '08:00', end: '11:00' }],
    TUE: [{ start: '08:00', end: '11:00' }],
    WED: [{ start: '08:00', end: '11:00' }],
    THU: [{ start: '08:00', end: '11:00' }],
    FRI: [{ start: '08:00', end: '11:00' }],
    SAT: [{ start: '08:00', end: '10:00' }],
  },
};

function newId(): string {
  return crypto.randomUUID();
}

type Props = {
  profileId: string;
  content: ContentSnapshot;
  locked: boolean;
  onNotice: (message: string | null) => void;
};

export function PlanningWorkspace({ profileId, content, locked, onNotice }: Props) {
  const [scenarios, setScenarios] = useState<PlanningScenario[]>([]);
  const [blocks, setBlocks] = useState<PlanBlock[]>([]);
  const [checkpoints, setCheckpoints] = useState<PlanningCheckpointRecord[]>([]);
  const [draft, setDraft] = useState<PlanningDraft | null>(null);
  const [conflicts, setConflicts] = useState<MergeConflict[]>([]);
  const [redistribution, setRedistribution] = useState<{
    moved: { blockId: string; from: string | null; to: string }[];
    stillUnallocatedIds: string[];
    blocks: PlanBlock[];
  } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<CalendarView>('week');

  const repository = useCallback(() => new LocalPlanningRepository(), []);

  const refresh = useCallback(async () => {
    const list = await repository().listScenarios(profileId);
    const allBlocks = await repository().listBlocks(profileId);
    setScenarios(list);
    setBlocks(allBlocks);
    setSelectedId((current) => {
      if (current && list.some((item) => item.id === current)) return current;
      return list[0]?.id ?? null;
    });
  }, [profileId, repository]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh().catch(() => undefined);
  }, [refresh]);

  const selected = scenarios.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCheckpoints([]);
      setDraft(null);
      return;
    }
    void (async () => {
      const [loadedCheckpoints, loadedDraft] = await Promise.all([
        repository().listCheckpoints(profileId, selected.id),
        repository().loadDraft(profileId, selected.id),
      ]);
      setCheckpoints(loadedCheckpoints);
      setDraft(loadedDraft);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, repository, selected?.id, selected?.localRevision]);

  const selectedBlocks = useMemo(
    () => blocks.filter((block) => block.scenarioId === selectedId),
    [blocks, selectedId],
  );

  // Capacity is global: every active scenario reserves time, not only the one
  // being edited.
  const officialReservations = useMemo(
    () => selectOfficialReservations(scenarios, blocks, profileId),
    [blocks, profileId, scenarios],
  );

  const calendarDays: CalendarDay[] = useMemo(() => {
    if (!selected) return [];
    const dated = selectedBlocks
      .map((block) => block.civilDate)
      .filter((value): value is string => typeof value === 'string')
      .sort();
    // Final stretch is consultable from the first planned day until the exam;
    // a cycle shows the days it actually has blocks for.
    const today = new Date().toISOString().slice(0, 10);
    const startDate =
      selected.kind === 'FINAL_STRETCH'
        ? (dated[0] ?? selected.examDate ?? today)
        : (dated[0] ?? today);
    const endDate =
      selected.kind === 'FINAL_STRETCH'
        ? (selected.examDate ?? dated[dated.length - 1] ?? startDate)
        : (dated[dated.length - 1] ?? startDate);
    return queryCalendar({
      profileId,
      rangeStart: startDate,
      rangeEnd: endDate,
      activeOnly: false,
      blocks,
      scenarios,
      availability: { zone: ZONE, weekly, exceptions: [] },
    });
  }, [blocks, profileId, scenarios, selected, selectedBlocks]);

  function wizardPreview(input: WizardInput) {
    try {
      return generatePlanPreview({
        scenario: {
          id: 'preview',
          profileId,
          editalId: input.editalId,
          kind: input.kind,
          name: input.name,
          status: 'DRAFT',
          localRevision: 1,
          schemaVersion: 1,
          priorityProfileId: 'priority-default',
          priorityProfileRevision: 1,
          examDate: input.kind === 'FINAL_STRETCH' ? input.examDate : null,
          referenceZone: ZONE,
        },
        profile: {
          id: 'priority-default',
          revision: 1,
          name: 'Padrão',
          weights: { urgency: 1, depth: 1, volume: 0.5, pending: 2 },
        },
        items: input.selectedLinks.map((item) => ({
          contentKey: item.editalDisciplineId,
          editalDisciplineId: item.editalDisciplineId,
          assuntoId: item.assuntoId,
          label: item.label,
          plannedMinutes: item.plannedMinutes,
          depth: 0,
        })),
        startDate: input.startDate,
        horizonDays: input.horizonDays,
        zone: ZONE,
        weekly,
        exceptions: [],
        // A new scenario for this edital replaces the one currently active,
        // so that plan's reservation is not counted against its successor.
        fixedBlocks: selectOfficialReservations(
          scenarios.filter((item) => item.editalId !== input.editalId),
          blocks,
          profileId,
        ),
        operationId: 'preview',
      });
    } catch {
      return { error: 'Não foi possível gerar a prévia com estes dados.' };
    }
  }

  async function createFromWizard(input: WizardInput, preview: ReturnType<typeof generatePlanPreview>): Promise<boolean> {
    const scenarioId = newId();
    const hasExam = input.kind === 'FINAL_STRETCH' && input.examDate;
    const cycle =
      input.kind === 'CYCLE'
        ? createCycleState({
            profileId,
            scenarioId,
            content: input.selectedLinks.map((item) => ({
              editalDisciplineId: item.editalDisciplineId,
              assuntoId: item.assuntoId,
              label: item.label,
              plannedMinutes: item.plannedMinutes,
            })),
          })
        : null;
    const created = await repository().commit({
      scope: { profileId, operationId: `create-${scenarioId}` },
      scenarioId,
      baseRevision: null,
      changes: {
        scenario: {
          id: scenarioId,
          profileId,
          editalId: input.editalId,
          kind: input.kind,
          name: input.name,
          status: 'DRAFT',
          localRevision: 1,
          schemaVersion: 1,
          priorityProfileId: 'priority-default',
          priorityProfileRevision: 1,
          examDate: hasExam ? input.examDate : null,
          referenceZone: ZONE,
          cycle,
        },
      },
    });
    if (created.kind !== 'LOCAL_COMMITTED') {
      onNotice('Cenário recusado.');
      return false;
    }
    const anyBlock = preview.blocks.length > 0 || preview.unallocated.length > 0;
    if (anyBlock) {
      const blocksResult = await repository().commit({
        scope: { profileId, operationId: `blocks-${scenarioId}` },
        scenarioId,
        baseRevision: 1,
        changes: {
          upsertBlocks: [...preview.blocks, ...preview.unallocated].map((block) => ({
            ...block,
            scenarioId,
            editalId: input.editalId,
            sourceOperationId: `blocks-${scenarioId}`,
          })),
        },
      });
      if (blocksResult.kind !== 'LOCAL_COMMITTED') {
        onNotice('Falha ao gravar os blocos: o cenário ficou em rascunho e não foi ativado.');
        await refresh();
        return false;
      }
    }
    const checkpointId = `checkpoint-${scenarioId}`;
    await repository().createCheckpoint({
      profileId,
      scenarioId,
      checkpointId,
      kind: 'MANUAL',
      operationId: `checkpoint-${scenarioId}`,
    });
    await repository().activateScenario({
      profileId,
      operationId: `activate-${scenarioId}`,
      editalId: input.editalId,
      scenarioId,
      checkpointId,
    });
    await refresh();
    setSelectedId(scenarioId);
    onNotice('Cenário criado e ativado localmente.');
    return true;
  }

  async function activate(scenarioId: string): Promise<void> {
    const scenario = scenarios.find((item) => item.id === scenarioId);
    if (!scenario) return;
    const checkpointId = `checkpoint-activate-${scenarioId}`;
    await repository().createCheckpoint({
      profileId,
      scenarioId,
      checkpointId,
      kind: 'MANUAL',
      operationId: `checkpoint-activate-${scenarioId}`,
    });
    const result = await repository().activateScenario({
      profileId,
      operationId: `activate-now-${scenarioId}`,
      editalId: scenario.editalId,
      scenarioId,
      checkpointId,
    });
    onNotice(result.kind === 'LOCAL_COMMITTED' ? 'Cenário ativado.' : 'Ativação bloqueada ou recusada.');
    await refresh();
  }

  async function applyCycleDecision(decision: CycleDecision): Promise<void> {
    if (!selected?.cycle) return;
    const next = advanceCycle(
      {
        ...selected.cycle,
        profileId,
        scenarioId: selected.id,
        localRevision: selected.localRevision,
      },
      decision,
    );
    const result = await repository().commit({
      scope: { profileId, operationId: `cycle-${selected.id}-${next.localRevision}` },
      scenarioId: selected.id,
      baseRevision: selected.localRevision,
      changes: {
        scenario: {
          ...selected,
          cycle: {
            content: next.content,
            cursorIndex: next.cursorIndex,
            round: next.round,
            pendings: next.pendings,
            history: next.history,
          },
        },
      },
    });
    if (result.kind !== 'LOCAL_COMMITTED') {
      onNotice('Não foi possível avançar o ciclo.');
    }
    await refresh();
  }

  async function changeExamDate(change: ExamDateChange): Promise<void> {
    if (!selected) return;
    const preview = previewExamDateChange({
      scenario: selected,
      blocks: selectedBlocks,
      change,
      referenceDate: selected.examDate ?? '2027-01-04',
      operationId: 'exam-change',
    });
    const result = await repository().commit({
      scope: { profileId, operationId: `exam-${selected.id}-${selected.localRevision}` },
      scenarioId: selected.id,
      baseRevision: selected.localRevision,
      changes: {
        scenario: preview.newScenario,
        deleteBlockIds: preview.affectedBlockIds.filter((id) =>
          selectedBlocks.some((block) => block.id === id && block.allocation === 'PROJECTED'),
        ),
      },
    });
    onNotice(
      result.kind === 'LOCAL_COMMITTED'
        ? `Prova atualizada. ${preview.affectedBlockIds.length} bloco(s) precisam de replanejamento.`
        : 'Não foi possível atualizar a prova; o planejamento anterior foi mantido.',
    );
    await refresh();
  }

  async function transitionToFinalStretch(examDate: string): Promise<void> {
    if (!selected || selected.kind !== 'CYCLE' || !selected.cycle) return;
    const nextScenarioId = `rf-${selected.id}`;
    const preview = previewFinalStretchTransition({
      cycle: selected,
      cycleState: {
        ...selected.cycle,
        profileId,
        scenarioId: selected.id,
        localRevision: selected.localRevision,
      },
      nextScenarioId,
      examDate,
      startDate: new Date().toISOString().slice(0, 10),
      zone: ZONE,
      weekly,
      exceptions: [],
      fixedBlocks: selectedBlocks,
      capacityBlocks: selectOfficialReservations(
        scenarios.filter((item) => item.id !== selected.id),
        blocks,
        profileId,
      ),
      operationId: `transition-${nextScenarioId}`,
    });
    const created = await repository().commit({
      scope: { profileId, operationId: `transition-${nextScenarioId}` },
      scenarioId: nextScenarioId,
      baseRevision: null,
      changes: { scenario: preview.newScenario },
    });
    if (created.kind !== 'LOCAL_COMMITTED') {
      onNotice('Não foi possível criar a Reta Final.');
      return;
    }
    if (preview.blocks.length > 0) {
      const blocksResult = await repository().commit({
        scope: { profileId, operationId: `transition-blocks-${nextScenarioId}` },
        scenarioId: nextScenarioId,
        baseRevision: 1,
        changes: { upsertBlocks: preview.blocks },
      });
      if (blocksResult.kind !== 'LOCAL_COMMITTED') {
        onNotice('Falha ao gravar os blocos da Reta Final; o cenário ficou em rascunho.');
        await refresh();
        return;
      }
    }
    await refresh();
    setSelectedId(nextScenarioId);
    onNotice(
      `Reta Final proposta com ${preview.blocks.length} bloco(s); o Ciclo anterior foi preservado.`,
    );
  }

  async function closeStretch(outcome: 'OCCURRED' | 'RESCHEDULED' | 'UNDEFINED'): Promise<void> {
    if (!selected) return;
    const closed = closeFinalStretch({
      scenario: selected,
      outcome,
      closedAt: new Date().toISOString(),
    });
    const result = await repository().commit({
      scope: { profileId, operationId: `close-${selected.id}-${selected.localRevision}` },
      scenarioId: selected.id,
      baseRevision: selected.localRevision,
      changes: {
        scenario: {
          ...closed.scenario,
          closing: closed.closing,
        },
      },
    });
    onNotice(
      result.kind === 'LOCAL_COMMITTED'
        ? 'Reta Final encerrada e preservada no histórico.'
        : 'Não foi possível encerrar a Reta Final.',
    );
    await refresh();
  }

  async function saveDraft(change: {
    blockId: string;
    field: DraftBlockField;
    value: string | number;
    baseValue: string | number;
  }): Promise<boolean> {
    if (!selected) return false;
    const next: PlanningDraft = {
      id: draft?.id ?? `draft-${selected.id}`,
      profileId,
      scenarioId: selected.id,
      baseRevision: selected.localRevision,
      changes: [
        ...(draft?.changes ?? []).filter(
          (item) => !(item.blockId === change.blockId && item.field === change.field),
        ),
        { ...change, field: change.field },
      ],
      lastSavedAt: new Date().toISOString(),
    };
    const result = await repository().saveDraft(next);
    if (result.kind === 'LOCAL_COMMITTED') {
      setDraft(result.value);
      onNotice('Rascunho salvo neste dispositivo.');
      return true;
    } else {
      onNotice('Não foi possível salvar o rascunho.');
      return false;
    }
  }

  async function applyDraft(): Promise<void> {
    if (!selected || !draft) return;
    const current = await repository().loadScenario(profileId, selected.id);
    if (!current) return;
    const preview = previewDraftCommit({ current, draft });
    setConflicts(preview.conflicts);
    const result = await applyPlanningDraft(repository(), {
      profileId,
      scenarioId: selected.id,
      draft,
      approval: { confirmed: true, previewToken: preview.previewToken },
    });
    onNotice(
      result.kind === 'LOCAL_COMMITTED'
        ? 'Rascunho aplicado localmente.'
        : result.kind === 'CONFLICT'
          ? 'Conflito: revise o rascunho antes de aplicar.'
          : 'Não foi possível aplicar o rascunho.',
    );
    await refresh();
  }

  async function relinkBlock(blockId: string, editalDisciplineId: string): Promise<void> {
    const block = selectedBlocks.find((item) => item.id === blockId);
    if (!block) return;
    const saved = await saveDraft({
      blockId,
      field: 'editalDisciplineId',
      value: editalDisciplineId,
      baseValue: block.editalDisciplineId,
    });
    if (saved) {
      onNotice('Vínculo proposto no rascunho; aplique o rascunho para efetivar.');
    }
  }

  async function restoreCheckpoint(checkpointId: string): Promise<void> {
    if (!selected) return;
    const target = checkpoints.find((item) => item.checkpointId === checkpointId);
    if (!target?.snapshot) return;
    const current = await repository().loadScenario(profileId, selected.id);
    if (!current) return;
    const preview = previewCompensation({
      direction: 'UNDO',
      target: target.snapshot,
      current,
      draftBlockIds: (draft?.changes ?? []).map((change) => change.blockId),
    });
    if (preview.kind === 'BLOCKED') {
      onNotice('Restauração bloqueada: há rascunho ou execução dependente destes blocos.');
      return;
    }
    // Restore is a compensating commit: it never rewrites an old state and it
    // also removes blocks that appeared after the checkpoint.
    const targetIds = new Set(target.snapshot.blocks.map((block) => block.id));
    const deleteBlockIds = current.blocks
      .filter((block) => !targetIds.has(block.id))
      .map((block) => block.id);
    const result = await repository().commit({
      scope: { profileId, operationId: `restore-${checkpointId}-${current.scenario.localRevision}` },
      scenarioId: selected.id,
      baseRevision: current.scenario.localRevision,
      changes: {
        scenario: {
          ...target.snapshot.scenario,
          localRevision: current.scenario.localRevision,
        },
        upsertBlocks: target.snapshot.blocks,
        deleteBlockIds,
      },
      summary: `restore ${checkpointId}`,
    });
    onNotice(
      result.kind === 'LOCAL_COMMITTED'
        ? 'Checkpoint restaurado como nova operação (plano e ciclo).'
        : 'Não foi possível restaurar o checkpoint.',
    );
    await refresh();
  }

  function previewRedistributionForScenario(): void {
    if (!selected) return;
    const preview = previewRedistribution({
      blocks: selectedBlocks,
      reservationBlocks: officialReservations,
      startDate: new Date().toISOString().slice(0, 10),
      horizonDays: 45,
      zone: ZONE,
      weekly,
      exceptions: [],
      operationId: `redistribute-${selected.id}`,
    });
    setRedistribution({
      moved: preview.moved,
      stillUnallocatedIds: preview.stillUnallocatedIds,
      blocks: preview.blocks,
    });
  }

  async function applyRedistribution(): Promise<void> {
    if (!selected || !redistribution || redistribution.moved.length === 0) return;
    const movedIds = new Set(redistribution.moved.map((item) => item.blockId));
    const upsert = redistribution.blocks.filter((block) => movedIds.has(block.id));
    const result = await repository().commit({
      scope: { profileId, operationId: `redistribute-apply-${selected.id}-${selected.localRevision}` },
      scenarioId: selected.id,
      baseRevision: selected.localRevision,
      changes: { upsertBlocks: upsert },
    });
    onNotice(
      result.kind === 'LOCAL_COMMITTED'
        ? `Redistribuição aplicada localmente (${upsert.length} bloco(s)).`
        : 'Redistribuição recusada.',
    );
    setRedistribution(null);
    await refresh();
  }

  async function resolveConflict(
    conflict: MergeConflict,
    choice: 'CURRENT' | 'INCOMING',
  ): Promise<void> {
    if (!draft) return;
    const matched = (change: { blockId: string; field: string }) =>
      change.blockId === conflict.blockId && change.field === conflict.field;
    let next: PlanningDraft;
    if (choice === 'CURRENT') {
      next = { ...draft, changes: draft.changes.filter((change) => !matched(change)) };
    } else {
      const block = selectedBlocks.find((item) => item.id === conflict.blockId);
      const currentValue = (block as unknown as Record<string, unknown> | undefined)?.[
        conflict.field as string
      ];
      next = {
        ...draft,
        changes: draft.changes.map((change) =>
          matched(change)
            ? { ...change, baseValue: (currentValue ?? null) as string | number | null }
            : change,
        ),
      };
    }
    const saved = await repository().saveDraft(next);
    if (saved.kind === 'LOCAL_COMMITTED') {
      setDraft(saved.value);
      setConflicts((items) => items.filter((item) => !matched(item)));
      onNotice(
        choice === 'CURRENT'
          ? 'Alteração do rascunho descartada; versão atual mantida.'
          : 'Rascunho rebaseado sobre a versão atual; aplique novamente.',
      );
    }
  }

  function exportSelected(): string {
    if (!selected) return '';
    return exportPlanningScenarios({
      scenarioIds: [selected.id],
      profileId,
      snapshots: [{ scenario: selected, blocks: selectedBlocks }],
      exportedAt: new Date().toISOString(),
    });
  }

  async function importPlanning(text: string, targetEditalId: string): Promise<string> {
    const parsed = parsePlanningImport(text, { namespace: `v2:${profileId}` });
    if (!parsed.ok) return `Importação recusada: ${parsed.reason}`;
    const preview = previewPlanningImport(
      parsed,
      scenarios.map((item) => ({ scenario: item, blocks: blocks.filter((block) => block.scenarioId === item.id) })),
    );
    const result = await new LocalPlanningImportCommitter().apply(profileId, preview, {
      confirmed: true,
      targetSignature: preview.targetSignature,
      targetEditalId,
    });
    await refresh();
    if (result.kind === 'LOCAL_COMMITTED') {
      return `Importado: ${result.value.applied} novo(s), ${result.value.skipped} equivalente(s).`;
    }
    if (result.kind === 'BLOCKED') return `Importação exige decisão humana (${result.reason}).`;
    return 'Falha na importação.';
  }

  const editais = content.editais.filter((edital) => edital.status === 'ACTIVE');
  const links = content.links.filter((link) => link.status === 'ACTIVE');

  return (
    <section className="planning-workspace" aria-labelledby="planning-title" data-testid="planning-workspace">
      <h2 id="planning-title">Planejamento, calendário e Reta Final</h2>
      <PlanningDashboard
        scenarios={scenarios}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onActivate={(id) => void activate(id)}
        locked={locked}
      />
      <PlanningWizard
        editais={editais}
        links={links}
        assuntos={content.assuntos}
        onPreview={wizardPreview}
        onConfirm={async (input) => {
          const preview = wizardPreview(input);
          if ('error' in preview) return false;
          return createFromWizard(input, preview);
        }}
        locked={locked}
      />
      <PlanningCalendar days={calendarDays} view={view} onView={setView} />
      <StudyCycle scenario={selected} onDecision={(decision) => void applyCycleDecision(decision)} locked={locked} />
      <FinalStretch
        scenario={selected}
        onChangeExamDate={(change) => void changeExamDate(change)}
        onTransition={(examDate) => void transitionToFinalStretch(examDate)}
        onClose={(outcome) => void closeStretch(outcome)}
        locked={locked}
      />
      <PlanningEditor
        blocks={selectedBlocks}
        draft={draft}
        onSaveDraft={(change) => void saveDraft(change)}
        onApplyDraft={() => void applyDraft()}
        redistribution={
          redistribution
            ? {
                moved: redistribution.moved.length,
                stillUnallocated: redistribution.stillUnallocatedIds.length,
              }
            : null
        }
        onPreviewRedistribution={previewRedistributionForScenario}
        onApplyRedistribution={() => void applyRedistribution()}
        links={links
          .filter((link) => !selected || link.editalId === selected.editalId)
          .map((link) => ({
            id: link.id,
            title:
              content.subjects.find((subject) => subject.id === link.subjectId)?.title ??
              link.displayAlias ??
              link.id,
          }))}
        onRelink={(blockId, editalDisciplineId) => void relinkBlock(blockId, editalDisciplineId)}
        locked={locked}
      />
      <PlanningHistory
        checkpoints={checkpoints}
        onRestore={(checkpointId) => void restoreCheckpoint(checkpointId)}
        locked={locked}
      />
      <PlanningConflicts
        conflicts={conflicts}
        onResolve={(conflict, choice) => void resolveConflict(conflict, choice)}
      />
      <PlanningPortability
        onExport={exportSelected}
        onImport={importPlanning}
        editais={editais}
        locked={locked}
      />
    </section>
  );
}
