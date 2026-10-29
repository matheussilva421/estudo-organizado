import { describe, expect, it } from 'vitest';
import {
  PlanningValidationError,
  validatePlanBlock,
  validateScenario,
  type PlanBlock,
  type PlanningScenario,
} from '../../src/domain/planning';

const baseScenario: PlanningScenario = {
  id: 'scenario-tjpb',
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

const baseBlock: PlanBlock = {
  id: 'block-1',
  profileId: 'profile-local',
  editalId: 'edital-tjpb',
  scenarioId: 'scenario-tjpb',
  editalDisciplineId: 'link-1',
  plannedMinutes: 60,
  allocation: 'PROJECTED',
  priority: 1,
  localRevision: 1,
  sourceOperationId: 'op-1',
};

function errorCode(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof PlanningValidationError) return error.code;
    throw error;
  }
  throw new Error('expected a PlanningValidationError');
}

describe('F3 planning domain', () => {
  it('scenario_is_scoped_and_requires_exam_date_for_final_stretch', () => {
    const cycle = validateScenario(baseScenario);
    expect(cycle.kind).toBe('CYCLE');
    // A cycle keeps its schedule without an invented exam date.
    expect(cycle.examDate ?? null).toBeNull();

    expect(
      errorCode(() => validateScenario({ ...baseScenario, kind: 'FINAL_STRETCH' })),
    ).toBe('EXAM_DATE_REQUIRED');

    const finalStretch = validateScenario({
      ...baseScenario,
      kind: 'FINAL_STRETCH',
      examDate: '2027-01-24',
    });
    expect(finalStretch.examDate).toBe('2027-01-24');

    expect(
      errorCode(() =>
        validateScenario({ ...baseScenario, examDate: '2027-01-24' }),
      ),
    ).toBe('CYCLE_FORBIDS_EXAM_DATE');

    expect(errorCode(() => validateScenario({ ...baseScenario, examDate: '2027-02-30', kind: 'FINAL_STRETCH' }))).toBe(
      'INVALID_CIVIL_DATE',
    );

    expect(errorCode(() => validateScenario({ ...baseScenario, editalId: '  ' }))).toBe(
      'IDENTIFIER_REQUIRED',
    );
    expect(errorCode(() => validateScenario({ ...baseScenario, localRevision: 0 }))).toBe(
      'INVALID_REVISION',
    );
  });

  it('block_rejects_invalid_scope_or_minutes', () => {
    const validated = validatePlanBlock(baseBlock, {
      profileId: 'profile-local',
      editalId: 'edital-tjpb',
      scenarioId: 'scenario-tjpb',
    });
    expect(validated).toEqual(baseBlock);

    expect(errorCode(() => validatePlanBlock({ ...baseBlock, plannedMinutes: 0 }))).toBe(
      'INVALID_MINUTES',
    );
    expect(errorCode(() => validatePlanBlock({ ...baseBlock, plannedMinutes: 30.5 }))).toBe(
      'INVALID_MINUTES',
    );
    expect(errorCode(() => validatePlanBlock({ ...baseBlock, id: '' }))).toBe(
      'IDENTIFIER_REQUIRED',
    );
    expect(
      errorCode(() =>
        validatePlanBlock({ ...baseBlock, profileId: 'profile-outro' }, {
          profileId: 'profile-local',
        }),
      ),
    ).toBe('PROFILE_MISMATCH');
  });

  it('profile_mixing_between_scope_and_block_is_rejected_without_mutation', () => {
    const original = { ...baseBlock };
    expect(
      errorCode(() =>
        validatePlanBlock({ ...baseBlock, profileId: 'profile-outro' }, {
          profileId: 'profile-local',
        }),
      ),
    ).toBe('PROFILE_MISMATCH');
    expect(
      errorCode(() => validatePlanBlock({ ...baseBlock, editalId: 'edital-dpe' }, {
        editalId: 'edital-tjpb',
      })),
    ).toBe('EDITAL_MISMATCH');
    expect(
      errorCode(() => validatePlanBlock({ ...baseBlock, scenarioId: 'scenario-x' }, {
        scenarioId: 'scenario-tjpb',
      })),
    ).toBe('SCENARIO_MISMATCH');
    expect(original).toEqual(baseBlock);
  });

  it('confirmed_allocation_requires_real_date_and_time', () => {
    expect(
      errorCode(() => validatePlanBlock({ ...baseBlock, allocation: 'CONFIRMED_DAY' })),
    ).toBe('DATE_REQUIRED');
    expect(
      errorCode(() =>
        validatePlanBlock({
          ...baseBlock,
          allocation: 'CONFIRMED_TIME',
          civilDate: '2027-01-24',
        }),
      ),
    ).toBe('START_REQUIRED');
    expect(
      validatePlanBlock({
        ...baseBlock,
        allocation: 'CONFIRMED_TIME',
        civilDate: '2027-01-24',
        localStart: '19:00',
        localEnd: '20:00',
        timeZone: 'America/Fortaleza',
      }).allocation,
    ).toBe('CONFIRMED_TIME');
  });
});
