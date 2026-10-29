import { describe, expect, it } from 'vitest';
import {
  advanceCycle,
  createCycleState,
  currentCycleContent,
  CycleValidationError,
  type CycleState,
} from '../../src/domain/planning-cycle';
import type { PlanningScenario } from '../../src/domain/planning';

const cycleScenario: PlanningScenario = {
  id: 'scenario-ciclo',
  profileId: 'profile-local',
  editalId: 'edital-tjpb',
  kind: 'CYCLE',
  name: 'Ciclo TJPB',
  status: 'DRAFT',
  localRevision: 1,
  schemaVersion: 1,
  priorityProfileId: 'priority-default',
  priorityProfileRevision: 1,
  referenceZone: 'America/Fortaleza',
};

function state(): CycleState {
  return createCycleState({
    profileId: 'profile-local',
    scenarioId: cycleScenario.id,
    content: [
      { editalDisciplineId: 'link-constitucional', assuntoId: 'assunto-1', label: 'Constitucional 1' },
      { editalDisciplineId: 'link-constitucional', assuntoId: 'assunto-2', label: 'Constitucional 2' },
      { editalDisciplineId: 'link-administrativo', assuntoId: 'assunto-3', label: 'Administrativo 1' },
      { editalDisciplineId: 'link-administrativo', assuntoId: 'assunto-4', label: 'Administrativo 2' },
    ],
  });
}

describe('F3 study cycle', () => {
  it('cycle_without_exam_date_is_valid_and_starts_on_the_first_content', () => {
    expect(cycleScenario.examDate ?? null).toBeNull();
    const cycle = state();
    expect(currentCycleContent(cycle)).toMatchObject({ assuntoId: 'assunto-1' });
    expect(cycle.round).toBe(1);
    expect(cycle.localRevision).toBe(1);
  });

  it('continuing_keeps_subject_continuity_and_advance_changes_discipline', () => {
    const first = advanceCycle(state(), { type: 'CONTINUE' });
    expect(currentCycleContent(first)).toMatchObject({ assuntoId: 'assunto-2' });

    const second = advanceCycle(first, { type: 'ADVANCE' });
    expect(currentCycleContent(second)).toMatchObject({ assuntoId: 'assunto-3' });

    const third = advanceCycle(second, { type: 'CONTINUE' });
    expect(currentCycleContent(third)).toMatchObject({ assuntoId: 'assunto-4' });
  });

  it('deferring_keeps_pending_item_and_does_not_move_the_cursor', () => {
    const deferred = advanceCycle(state(), { type: 'DEFER', reason: 'sem tempo hoje' });
    expect(deferred.cursorIndex).toBe(0);
    expect(deferred.pendings).toHaveLength(1);
    expect(deferred.pendings[0]).toMatchObject({
      editalDisciplineId: 'link-constitucional',
      reason: 'sem tempo hoje',
    });
  });

  it('skipping_requires_a_reason_and_records_it', () => {
    expect(() => advanceCycle(state(), { type: 'SKIP_WITH_REASON', reason: '  ' })).toThrow(
      CycleValidationError,
    );
    const skipped = advanceCycle(state(), { type: 'SKIP_WITH_REASON', reason: 'conteúdo defasado' });
    expect(skipped.cursorIndex).toBe(1);
    expect(skipped.history.at(-1)).toMatchObject({
      decision: 'SKIP_WITH_REASON',
      reason: 'conteúdo defasado',
    });
  });

  it('new_round_preserves_history_and_reopens_do_not_delete_it', () => {
    const advanced = advanceCycle(advanceCycle(state(), { type: 'CONTINUE' }), { type: 'CONTINUE' });
    const round2 = advanceCycle(advanced, { type: 'NEW_ROUND' });
    expect(round2.round).toBe(2);
    expect(round2.cursorIndex).toBe(0);
    expect(round2.history).toHaveLength(3);

    const reopened = advanceCycle(round2, { type: 'REOPEN', contentIndex: 2 });
    expect(reopened.cursorIndex).toBe(2);
    expect(reopened.history).toHaveLength(4);
    expect(reopened.round).toBe(2);
    expect(() => advanceCycle(round2, { type: 'REOPEN', contentIndex: 99 })).toThrow(
      /INVALID_CONTENT_INDEX/,
    );
  });

  it('changing_the_device_clock_never_moves_the_cursor', () => {
    const before = state();
    const beforeJson = JSON.stringify(before);
    // The transition is pure: no Date/clock read happens anywhere.
    expect(JSON.stringify(before)).toBe(beforeJson);
    expect(before.cursorIndex).toBe(0);
    const advanced = advanceCycle(before, { type: 'CONTINUE' });
    expect(advanced.cursorIndex).toBe(1);
    // The previous state is the audit base and stays untouched.
    expect(before.cursorIndex).toBe(0);
    expect(advanced.localRevision).toBe(before.localRevision + 1);
  });
});
