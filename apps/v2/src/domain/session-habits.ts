import {
  SessionValidationError,
  type StudySession,
} from './session';
import { sumVerifiedFocusMs } from './session-clock';
import { isCivilDate, isValidTimeZone } from './planning-time';

export type HabitRecurrence = 'DAILY' | 'WEEKLY';

export type StudyHabit = {
  id: string;
  profileId: string;
  kind: 'TIME' | 'QUESTIONS' | 'MANUAL';
  target?: number;
  referenceZone: string;
  recurrence: HabitRecurrence;
  localRevision: number;
};

export type HabitOccurrence = {
  id: string;
  habitId: string;
  profileId: string;
  civilDate: string;
  confirmed: boolean;
  localRevision: number;
  sourceOperationId: string;
};

export type HabitEvidence = {
  progress: number;
  targetMet: boolean;
  needsReview: boolean;
};

function fail(code: string, message: string): never {
  throw new SessionValidationError(code, message);
}

export function validateHabit(habit: StudyHabit): StudyHabit {
  if (!habit || typeof habit !== 'object') fail('INVALID_HABIT', 'habit is required');
  if (
    typeof habit.id !== 'string' ||
    !habit.id.trim() ||
    typeof habit.profileId !== 'string' ||
    !habit.profileId.trim()
  ) {
    fail('INVALID_HABIT', 'habit identifiers are required');
  }
  if (habit.kind !== 'TIME' && habit.kind !== 'QUESTIONS' && habit.kind !== 'MANUAL') {
    fail('INVALID_HABIT', 'unknown habit kind');
  }
  if (!isValidTimeZone(habit.referenceZone)) {
    fail('INVALID_TIME_ZONE', 'habit reference zone must be a valid IANA zone');
  }
  if (habit.recurrence !== 'DAILY' && habit.recurrence !== 'WEEKLY') {
    fail('INVALID_HABIT', 'unknown recurrence');
  }
  if (
    habit.target !== undefined &&
    (typeof habit.target !== 'number' ||
      !Number.isFinite(habit.target) ||
      habit.target < 0)
  ) {
    fail('INVALID_HABIT', 'target must be finite and non-negative');
  }
  if (!Number.isInteger(habit.localRevision) || habit.localRevision < 1) {
    fail('INVALID_HABIT', 'localRevision must be a positive integer');
  }
  return habit;
}

export function getHabitEvidence(
  habit: StudyHabit,
  sessions: readonly StudySession[],
  date: string,
): HabitEvidence {
  validateHabit(habit);
  if (!isCivilDate(date)) fail('INVALID_CIVIL_DATE', 'civil date is required');
  if (habit.kind === 'MANUAL') {
    return { progress: 0, targetMet: false, needsReview: false };
  }
  const relevant = sessions.filter(
    (session) =>
      session.profileId === habit.profileId &&
      session.recordedAtCivilDate === date &&
      session.tombstone !== true,
  );
  const progress = relevant.reduce((total, session) => {
    if (habit.kind === 'QUESTIONS') {
      return (
        total +
        (session.measurements ?? []).reduce(
          (sum, measurement) => sum + measurement.questions,
          0,
        )
      );
    }
    return total + (session.manualDeclaredMs ?? 0) + sumVerifiedFocusMs(session.intervals);
  }, 0);
  const targetMet = habit.target !== undefined && progress >= habit.target;
  return { progress, targetMet, needsReview: targetMet };
}

export function evaluateHabitOccurrence(
  habit: StudyHabit,
  occurrence: HabitOccurrence,
  sessions: readonly StudySession[],
  date: string,
): { confirmed: boolean; targetMet: boolean; needsReview: boolean } {
  const evidence = getHabitEvidence(habit, sessions, date);
  if (occurrence.confirmed && !evidence.targetMet) {
    return { confirmed: true, targetMet: false, needsReview: true };
  }
  return {
    confirmed: occurrence.confirmed,
    targetMet: evidence.targetMet,
    needsReview: false,
  };
}
