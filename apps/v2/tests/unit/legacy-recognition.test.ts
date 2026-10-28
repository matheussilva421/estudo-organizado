import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  compareLegacyPlan,
  recognizeLegacyFormat,
} from '../../src/platform/legacy/recognize';

const fixtures = resolve(process.cwd(), 'tests/fixtures');

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(fixtures, name), 'utf8'));
}

describe('legacy recognition', () => {
  it('legacy_without_v2_metadata_is_not_missing', () => {
    const result = recognizeLegacyFormat({
      planejamento: {
        tipo: 'reta_final',
        retaFinal: { blocos: [{ id: 'b1', assunto: 'A' }] },
      },
    });

    expect(result.kind).toBe('V1_SUPPORTED');
    expect(result.schemaVersion).toBeUndefined();
  });

  it('180_equivalent_blocks_compare_without_overwrite', () => {
    const left = fixture('reta-final-legacy-equivalent.json');
    const right = fixture('reta-final-legacy-equivalent-derived.json');
    const before = JSON.stringify(left);

    expect(compareLegacyPlan(left, right)).toBe('EQUIVALENT');
    expect(JSON.stringify(left)).toBe(before);
  });

  it('divergent_legacy_blocks_do_not_overwrite', () => {
    const left = fixture('reta-final-legacy-equivalent.json');
    const right = fixture('reta-final-legacy-divergent.json');

    expect(compareLegacyPlan(left, right)).toBe('DIVERGENT');
  });

  it('schema_12_11_9_7_is_explicitly_classified', () => {
    const schemas = fixture('v1-schemas.json') as Array<{ schemaVersion: number }>;

    for (const schema of schemas) {
      const result = recognizeLegacyFormat(schema);
      expect(result).toEqual({ kind: 'V1_SUPPORTED', schemaVersion: schema.schemaVersion });
    }
  });

  it('unknown_format_is_quarantined', () => {
    expect(recognizeLegacyFormat({ schemaVersion: 99 })).toEqual({ kind: 'UNSUPPORTED' });
    expect(recognizeLegacyFormat(null)).toEqual({ kind: 'INVALID' });
  });
});
