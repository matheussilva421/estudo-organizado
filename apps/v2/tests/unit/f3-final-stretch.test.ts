import { describe, expect, it } from 'vitest';
import {
  closeFinalStretch,
  previewExamDateChange,
  previewFinalStretchTransition,
} from '../../src/domain/planning-final-stretch';
import { createCycleState } from '../../src/domain/planning-cycle';
import { PlanningValidationError, type PlanBlock, type PlanningScenario } from '../../src/domain/planning';
import type { WeeklyAvailability } from '../../src/domain/planning-capacity';

const zone = 'America/Fortaleza';

const cycle: PlanningScenario = {
  id: 'scenario-ciclo',
  profileId: 'profile-local',
  editalId: 'edital-tjpb',
  kind: 'CYCLE',
  name: 'Ciclo',
  status: 'ACTIVE',
  localRevision: 3,
  schemaVersion: 1,
  priorityProfileId: 'priority-default',
  priorityProfileRevision: 1,
  referenceZone: zone,
};

const weekly: WeeklyAvailability = {
  timeZone: zone,
  days: {
    MON: [{ start: '08:00', end: '10:00' }],
    TUE: [{ start: '08:00', end: '10:00' }],
    WED: [{ start: '08:00', end: '10:00' }],
    THU: [{ start: '08:00', end: '10:00' }],
    FRI: [{ start: '08:00', end: '10:00' }],
  },
};

const cycleState = createCycleState({
  profileId: 'profile-local',
  scenarioId: cycle.id,
  content: [
    { editalDisciplineId: 'link-constitucional', assuntoId: 'assunto-1', plannedMinutes: 60 },
    { editalDisciplineId: 'link-administrativo', assuntoId: 'assunto-2', plannedMinutes: 60 },
  ],
});

const fixed: PlanBlock = {
  id: 'fixed-1',
  profileId: 'profile-local',
  editalId: 'edital-tjpb',
  scenarioId: cycle.id,
  editalDisciplineId: 'link-constitucional',
  assuntoId: 'assunto-1',
  plannedMinutes: 60,
  allocation: 'CONFIRMED_TIME',
  civilDate: '2027-01-05',
  localStart: '08:00',
  localEnd: '09:00',
  timeZone: zone,
  priority: 1,
  localRevision: 1,
  sourceOperationId: 'op-fixed',
};

describe('F3 final stretch', () => {
  it('final_stretch_requires_a_confirmed_civil_date', () => {
    expect(() =>
      previewFinalStretchTransition({
        cycle,
        cycleState,
        nextScenarioId: 'scenario-rf',
        examDate: '2027-02-30',
        startDate: '2027-01-04',
        zone,
        weekly,
        exceptions: [],
        fixedBlocks: [],
        operationId: 'op-rf',
      }),
    ).toThrow(PlanningValidationError);
  });

  it('transition_preserves_references_and_the_cycle_itself', () => {
    const frozen = JSON.stringify(cycle);
    const preview = previewFinalStretchTransition({
      cycle,
      cycleState,
      nextScenarioId: 'scenario-rf',
      examDate: '2027-01-24',
      startDate: '2027-01-04',
      zone,
      weekly,
      exceptions: [],
      fixedBlocks: [fixed],
      operationId: 'op-rf',
    });

    expect(preview.newScenario).toMatchObject({
      id: 'scenario-rf',
      kind: 'FINAL_STRETCH',
      status: 'DRAFT',
      examDate: '2027-01-24',
    });
    expect(JSON.stringify(cycle)).toBe(frozen);
    // The confirmed block keeps its identity and is carried into the new scenario.
    expect(preview.preservedBlockIds).toContain('fixed-1');
    expect(preview.blocks.find((block) => block.id === 'fixed-1')?.scenarioId).toBe('scenario-rf');
    // F2 references survive; nothing is duplicated.
    const ids = preview.blocks.map((block) => block.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(preview.blocks.some((block) => block.assuntoId === 'assunto-2')).toBe(true);
    expect(preview.requiresConfirmation).toBe(true);
  });

  it('postponing_changes_only_future_planning', () => {
    const finalScenario: PlanningScenario = {
      ...cycle,
      id: 'scenario-rf',
      kind: 'FINAL_STRETCH',
      status: 'ACTIVE',
      examDate: '2027-01-24',
    };
    const blocks: PlanBlock[] = [
      { ...fixed, scenarioId: 'scenario-rf', id: 'confirmed-before', civilDate: '2027-01-10' },
      {
        ...fixed,
        id: 'projected-before',
        scenarioId: 'scenario-rf',
        allocation: 'PROJECTED',
        civilDate: '2027-01-12',
      },
      {
        ...fixed,
        id: 'projected-after',
        scenarioId: 'scenario-rf',
        allocation: 'PROJECTED',
        civilDate: '2027-03-01',
      },
      { ...fixed, id: 'other-edital', scenarioId: 'scenario-dpe', editalId: 'edital-dpe' },
    ];

    const preview = previewExamDateChange({
      scenario: finalScenario,
      blocks,
      change: { kind: 'POSTPONE', nextExamDate: '2027-02-20' },
      referenceDate: '2027-01-04',
      operationId: 'op-postpone',
    });

    expect(preview.newScenario.examDate).toBe('2027-02-20');
    expect(preview.preservedBlockIds).toContain('confirmed-before');
    expect(preview.preservedBlockIds).toContain('projected-before');
    expect(preview.affectedBlockIds).toEqual(['projected-after']);
    expect(preview.blocks.some((block) => block.id === 'other-edital')).toBe(false);
    expect(preview.requiresConfirmation).toBe(true);
  });

  it('suspending_or_cancelling_stops_future_projections', () => {
    const finalScenario: PlanningScenario = {
      ...cycle,
      id: 'scenario-rf',
      kind: 'FINAL_STRETCH',
      status: 'ACTIVE',
      examDate: '2027-01-24',
    };
    const blocks: PlanBlock[] = [
      { ...fixed, scenarioId: 'scenario-rf', id: 'confirmed' },
      {
        ...fixed,
        id: 'projected',
        scenarioId: 'scenario-rf',
        allocation: 'PROJECTED',
        civilDate: '2027-01-12',
      },
    ];
    const preview = previewExamDateChange({
      scenario: finalScenario,
      blocks,
      change: { kind: 'SUSPEND' },
      referenceDate: '2027-01-04',
      operationId: 'op-suspend',
    });
    expect(preview.newScenario.status).toBe('SUSPENDED');
    expect(preview.newScenario.examDate).toBeNull();
    expect(preview.affectedBlockIds).toEqual(['projected']);
    expect(preview.blocks.map((block) => block.id)).toEqual(['confirmed']);
    expect(preview.warnings).toContain('PROJECTIONS_SUSPENDED');
  });

  it('an_expired_exam_date_is_not_presumed_realized', () => {
    const finalScenario: PlanningScenario = {
      ...cycle,
      id: 'scenario-rf',
      kind: 'FINAL_STRETCH',
      status: 'ACTIVE',
      examDate: '2027-01-24',
    };
    const preview = previewExamDateChange({
      scenario: finalScenario,
      blocks: [{ ...fixed, scenarioId: 'scenario-rf' }],
      change: { kind: 'EXPIRE_CHECK' },
      referenceDate: '2027-01-25',
      operationId: 'op-expire',
    });
    expect(preview.warnings).toContain('EXAM_DATE_PASSED_REQUIRES_CONFIRMATION');
    expect(preview.newScenario.status).toBe('ACTIVE');
    expect(preview.requiresConfirmation).toBe(true);
  });

  it('closing_is_explicit_and_keeps_the_history', () => {
    const finalScenario: PlanningScenario = {
      ...cycle,
      id: 'scenario-rf',
      kind: 'FINAL_STRETCH',
      status: 'ACTIVE',
      examDate: '2027-01-24',
    };
    const closed = closeFinalStretch({
      scenario: finalScenario,
      outcome: 'OCCURRED',
      closedAt: '2027-01-25T10:00:00.000Z',
    });
    expect(closed.scenario.status).toBe('CLOSED');
    expect(closed.scenario.localRevision).toBe(finalScenario.localRevision + 1);
    expect(closed.closing.outcome).toBe('OCCURRED');
    expect(() =>
      closeFinalStretch({ scenario: cycle, outcome: 'OCCURRED', closedAt: 'x' }),
    ).toThrow(/NOT_A_FINAL_STRETCH_SCENARIO/);
  });
});
