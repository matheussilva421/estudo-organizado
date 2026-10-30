import { describe, expect, it } from 'vitest';
import {
  summarizeMeasurements,
  validateMaterialRef,
  validateMeasurement,
} from '../../src/domain/session-measurements';
import type {
  StudyMaterialRef,
  StudyMeasurement,
} from '../../src/domain/session';

function measurement(overrides: Partial<StudyMeasurement> = {}): StudyMeasurement {
  return {
    id: 'measurement-1',
    sessionId: 'session-1',
    allocationId: 'allocation-1',
    questions: 40,
    correctAnswers: 30,
    ...overrides,
  };
}

function material(overrides: Partial<StudyMaterialRef> = {}): StudyMaterialRef {
  return {
    id: 'material-1',
    kind: 'PDF',
    title: 'Direito Constitucional',
    url: 'https://example.com/material.pdf',
    ...overrides,
  };
}

describe('F4 measurements and materials', () => {
  it('forty_questions_thirty_correct_are_counted_once', () => {
    expect(summarizeMeasurements([measurement()])).toEqual({
      questions: 40,
      correctAnswers: 30,
      unclassifiedQuestions: 0,
    });
  });

  it('correct_31_of_30_is_invalid', () => {
    expect(() =>
      validateMeasurement(measurement({ questions: 30, correctAnswers: 31 })),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_MEASUREMENT' }));
  });

  it('unclassified_15_questions_stays_unclassified', () => {
    expect(
      summarizeMeasurements([
        measurement({
          allocationId: undefined,
          questions: 15,
          correctAnswers: 10,
        }),
      ]),
    ).toEqual({
      questions: 15,
      correctAnswers: 10,
      unclassifiedQuestions: 15,
    });
  });

  it('page_range_38_before_12_invalid', () => {
    expect(() =>
      validateMeasurement(measurement({ pages: { from: 38, to: 12 } })),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_PAGE_RANGE' }));
  });

  it('unsafe_url_is_rejected', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,hello', 'file:///C:/x.pdf']) {
      expect(() => validateMaterialRef(material({ url }))).toThrowError(
        expect.objectContaining({ code: 'UNSAFE_URL' }),
      );
    }
  });

  it('same_material_id_does_not_copy_pdf', () => {
    const validated = validateMaterialRef(material());
    expect(validated.id).toBe('material-1');
    expect('file' in validated).toBe(false);
    expect('blob' in validated).toBe(false);
  });
});
