import { describe, expect, it } from 'vitest';
import {
  exportPlanningScenarios,
  parsePlanningImport,
  previewPlanningImport,
} from '../../src/application/planning-portability';
import type { PlanBlock, PlanningScenario, PlanningScenarioSnapshot } from '../../src/domain/planning';

const legacy = JSON.stringify({
  nome: 'Reta Final TJPB',
  dataProva: '2027-01-24',
  blocos: [
    { conteudo: 'Constitucional', duracao: 60, data: '2027-01-05' },
    { conteudo: 'Administrativo', duracao: 45, data: '2027-01-06', inicio: '08:00', fim: '08:45' },
  ],
});

function scenario(id = 'scenario-tjpb', name = 'Reta Final TJPB'): PlanningScenario {
  return {
    id,
    profileId: 'profile-local',
    editalId: 'edital-tjpb',
    kind: 'FINAL_STRETCH',
    name,
    status: 'DRAFT',
    localRevision: 1,
    schemaVersion: 1,
    priorityProfileId: 'priority-default',
    priorityProfileRevision: 1,
    examDate: '2027-01-24',
    referenceZone: 'America/Fortaleza',
    provenance: 'v2:profile-local',
  };
}

function block(id = 'block-1'): PlanBlock {
  return {
    id,
    profileId: 'profile-local',
    editalId: 'edital-tjpb',
    scenarioId: 'scenario-tjpb',
    editalDisciplineId: 'link-1',
    assuntoId: 'assunto-1',
    plannedMinutes: 60,
    allocation: 'PROJECTED',
    civilDate: '2027-01-05',
    priority: 1,
    localRevision: 1,
    sourceOperationId: 'op-1',
  };
}

describe('F3 planning import parsing', () => {
  it('legacy_files_without_versions_are_accepted_when_valid', () => {
    const parsed = parsePlanningImport(legacy, { namespace: 'legacy:v1' });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.format).toBe('V1_RETA_FINAL');
    expect(parsed.scenarios[0]?.blocks).toHaveLength(2);
    expect(parsed.scenarios[0]?.scenario.examDate).toBe('2027-01-24');
    expect(parsed.warnings).toEqual(
      expect.arrayContaining([
        'LEGACY_WITHOUT_SCHEMA_VERSION',
        'LEGACY_WITHOUT_PLAN_ID',
        'LEGACY_WITHOUT_REVISION',
      ]),
    );
  });

  it('hostile_payloads_are_rejected_without_effect', () => {
    expect(parsePlanningImport('{not json', { namespace: 'x' })).toEqual({
      ok: false,
      reason: 'INVALID_JSON',
    });
    expect(
      parsePlanningImport('{"blocos":[' + '['.repeat(40) + ']'.repeat(40) + ']}', {
        namespace: 'x',
      }),
    ).toEqual({ ok: false, reason: 'TOO_DEEP' });
    expect(
      parsePlanningImport('{"blocos":[{"duracao":60}],"__proto__":{"x":1}}', {
        namespace: 'x',
      }),
    ).toEqual({ ok: false, reason: 'UNSAFE_KEYS' });
    expect(parsePlanningImport('x'.repeat(2_000_001), { namespace: 'x' })).toEqual({
      ok: false,
      reason: 'OVERSIZE',
    });
  });

  it('equivalent_imports_do_not_duplicate_and_names_never_merge', () => {
    const parsed = parsePlanningImport(legacy, { namespace: 'legacy:v1' });
    if (!parsed.ok) throw new Error('parse failed');

    const existing: PlanningScenarioSnapshot[] = [
      {
        scenario: { ...scenario(), name: 'Reta Final TJPB' },
        blocks: [
          {
            ...block(),
            label: 'Constitucional',
            plannedMinutes: 60,
            civilDate: '2027-01-05',
          },
          {
            ...block('block-2'),
            label: 'Administrativo',
            plannedMinutes: 45,
            civilDate: '2027-01-06',
            localStart: '08:00',
            localEnd: '08:45',
            allocation: 'CONFIRMED_TIME',
          },
        ],
      },
    ];
    const equivalent = previewPlanningImport(parsed, []);
    expect(equivalent.entries[0]?.kind).toBe('NEW');
    expect(equivalent.automaticMerges).toBe(0);

    const sameName = previewPlanningImport(parsed, [
      { scenario: { ...scenario('other', 'Reta Final TJPB'), provenance: 'outra-origem' }, blocks: [] },
    ]);
    expect(sameName.entries[0]?.kind).toBe('AMBIGUOUS');
    expect(sameName.automaticMerges).toBe(0);
    expect(existing).toHaveLength(1);
  });

  it('same_source_with_different_content_is_divergent', () => {
    const parsed = parsePlanningImport(legacy, { namespace: 'legacy:v1' });
    if (!parsed.ok) throw new Error('parse failed');
    const preview = previewPlanningImport(parsed, [
      {
        scenario: { ...scenario(), name: 'Reta Final TJPB', provenance: parsed.scenarios[0]?.scenario.provenance },
        blocks: [block()],
      },
    ]);
    expect(preview.entries[0]?.kind).toBe('DIVERGENT');
  });

  it('an_equivalent_import_is_recognised_and_never_duplicated', () => {
    const parsed = parsePlanningImport(legacy, { namespace: 'legacy:v1' });
    if (!parsed.ok) throw new Error('parse failed');
    const parsedScenario = parsed.scenarios[0]!;
    const blocks: PlanBlock[] = parsedScenario.blocks.map((item, index) => ({
      id: `block-${index}`,
      profileId: 'profile-local',
      editalId: 'edital-tjpb',
      scenarioId: 'scenario-tjpb',
      // Matches the parsed shape exactly: the legacy file has no F2 reference.
      editalDisciplineId: item.editalDisciplineId ?? '',
      assuntoId: item.assuntoId,
      aulaId: item.aulaId,
      plannedMinutes: item.plannedMinutes,
      allocation: item.allocation,
      civilDate: item.civilDate,
      localStart: item.localStart,
      localEnd: item.localEnd,
      priority: 1,
      localRevision: 1,
      sourceOperationId: 'op-1',
      label: item.label,
    }));
    const preview = previewPlanningImport(parsed, [
      {
        scenario: {
          ...scenario(),
          provenance: parsedScenario.scenario.provenance,
        },
        blocks,
      },
    ]);
    expect(preview.entries[0]?.kind).toBe('EQUIVALENT');
    expect(preview.automaticMerges).toBe(0);
  });
});

describe('F3 selective export', () => {
  it('exports_only_the_chosen_scenario_without_sensitive_fields', () => {
    const snapshots: PlanningScenarioSnapshot[] = [
      { scenario: scenario('scenario-tjpb', 'TJPB'), blocks: [block()] },
      {
        scenario: { ...scenario('scenario-dpe', 'DPE-PB'), editalId: 'edital-dpe' },
        blocks: [block('dpe-block')],
      },
    ];
    const exported = exportPlanningScenarios({
      scenarioIds: ['scenario-tjpb'],
      profileId: 'profile-local',
      snapshots,
      exportedAt: '2026-10-29T00:00:00.000Z',
    });
    const parsed = JSON.parse(exported) as {
      scenarios: { scenario: { id: string }; blocks: PlanBlock[] }[];
    };
    expect(parsed.scenarios.map((item) => item.scenario.id)).toEqual(['scenario-tjpb']);
    expect(exported).not.toMatch(/refreshToken|accessToken|deliveryUid|outbox|sessionId/);
    expect(parsed.scenarios[0]?.blocks).toHaveLength(1);
  });

  it('roundtrip_preserves_semantic_content', () => {
    const snapshots: PlanningScenarioSnapshot[] = [
      { scenario: scenario(), blocks: [block()] },
    ];
    const exported = exportPlanningScenarios({
      scenarioIds: ['scenario-tjpb'],
      profileId: 'profile-local',
      snapshots,
    });
    const parsed = parsePlanningImport(exported, { namespace: 'v2:profile-local' });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.format).toBe('V2_PLANNING');
    expect(parsed.scenarios[0]?.blocks[0]).toMatchObject({
      plannedMinutes: 60,
      civilDate: '2027-01-05',
      assuntoId: 'assunto-1',
    });
  });
});
