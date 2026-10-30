import {
  SessionValidationError,
  type StudyMaterialRef,
  type StudyMeasurement,
} from './session';

export type { StudyMaterialRef, StudyMeasurement } from './session';

const MATERIAL_KINDS: readonly StudyMaterialRef['kind'][] = [
  'PDF',
  'VIDEO',
  'BOOK',
  'SITE',
  'OTHER',
];

function fail(code: string, message: string): never {
  throw new SessionValidationError(code, message);
}

function validatePageRange(
  pages: { from: number; to: number },
  code: string,
): void {
  if (
    !pages ||
    !Number.isInteger(pages.from) ||
    !Number.isInteger(pages.to) ||
    pages.from < 1 ||
    pages.to < 1 ||
    pages.from > pages.to
  ) {
    fail(code, 'page range must be positive and ordered');
  }
}

export function validateMeasurement(input: StudyMeasurement): StudyMeasurement {
  if (!input || typeof input !== 'object') {
    fail('INVALID_MEASUREMENT', 'measurement is required');
  }
  if (
    typeof input.id !== 'string' ||
    !input.id.trim() ||
    typeof input.sessionId !== 'string' ||
    !input.sessionId.trim()
  ) {
    fail('INVALID_MEASUREMENT', 'measurement identifiers are required');
  }
  if (!Number.isInteger(input.questions) || input.questions < 0) {
    fail('INVALID_MEASUREMENT', 'questions must be a non-negative integer');
  }
  if (
    !Number.isInteger(input.correctAnswers) ||
    input.correctAnswers < 0 ||
    input.correctAnswers > input.questions
  ) {
    fail('INVALID_MEASUREMENT', 'correctAnswers must be between zero and questions');
  }
  if (
    input.allocationId !== undefined &&
    (typeof input.allocationId !== 'string' || !input.allocationId.trim())
  ) {
    fail('INVALID_MEASUREMENT', 'allocationId must be a non-empty string');
  }
  if (input.pages !== undefined) {
    validatePageRange(input.pages, 'INVALID_PAGE_RANGE');
  }
  return input;
}

export function validateMaterialRef(input: StudyMaterialRef): StudyMaterialRef {
  if (!input || typeof input !== 'object') {
    fail('INVALID_MATERIAL', 'material reference is required');
  }
  if (
    typeof input.id !== 'string' ||
    !input.id.trim() ||
    typeof input.title !== 'string' ||
    !input.title.trim()
  ) {
    fail('INVALID_MATERIAL', 'material identifiers and title are required');
  }
  if (!MATERIAL_KINDS.includes(input.kind)) {
    fail('INVALID_MATERIAL', 'unknown material kind');
  }
  if (
    input.catalogId !== undefined &&
    (typeof input.catalogId !== 'string' || !input.catalogId.trim())
  ) {
    fail('INVALID_MATERIAL', 'catalogId must be a non-empty string');
  }
  if (input.notes !== undefined && typeof input.notes !== 'string') {
    fail('INVALID_MATERIAL', 'notes must be a string');
  }
  if (input.pages !== undefined) {
    validatePageRange(input.pages, 'INVALID_PAGE_RANGE');
  }
  if (input.videoRangeMs !== undefined) {
    const range = input.videoRangeMs;
    if (
      !range ||
      typeof range.from !== 'number' ||
      typeof range.to !== 'number' ||
      !Number.isFinite(range.from) ||
      !Number.isFinite(range.to) ||
      range.from < 0 ||
      range.to < 0 ||
      range.from > range.to
    ) {
      fail('INVALID_VIDEO_RANGE', 'video range must be finite and ordered');
    }
  }
  if (input.url !== undefined) {
    let parsed: URL;
    try {
      parsed = new URL(input.url);
    } catch {
      fail('INVALID_MATERIAL', 'url must be absolute');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      fail('UNSAFE_URL', 'only http and https URLs are allowed');
    }
  }
  return input;
}

export function summarizeMeasurements(measurements: readonly StudyMeasurement[]): {
  questions: number;
  correctAnswers: number;
  unclassifiedQuestions: number;
} {
  if (!Array.isArray(measurements)) {
    fail('INVALID_MEASUREMENT', 'measurements must be an array');
  }
  let questions = 0;
  let correctAnswers = 0;
  let unclassifiedQuestions = 0;
  for (const measurement of measurements) {
    validateMeasurement(measurement);
    questions += measurement.questions;
    correctAnswers += measurement.correctAnswers;
    if (measurement.allocationId === undefined) {
      unclassifiedQuestions += measurement.questions;
    }
  }
  return { questions, correctAnswers, unclassifiedQuestions };
}
