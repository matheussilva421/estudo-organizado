import type { CivilDate } from './planning';
import { compareCivilDate } from './planning-time';

/**
 * Versioned, explainable priorities.
 *
 * A scenario pins one profile revision; editing a profile creates a new
 * revision and never rewrites the one already in use. Only declared criteria
 * are used - no performance data from F4/F5 is inferred here.
 */

export type PriorityWeights = {
  urgency: number;
  depth: number;
  volume: number;
  pending: number;
};

export type PriorityProfile = {
  id: string;
  revision: number;
  name: string;
  weights: PriorityWeights;
  /** Explicit local multipliers by content key. */
  overrides?: Record<string, number>;
  provenance?: string;
};

export type PriorityItem = {
  contentKey: string;
  editalDisciplineId: string;
  assuntoId?: string;
  aulaId?: string;
  label?: string;
  /** Depth in the F2 tree; deeper content is more specific. */
  depth?: number;
  plannedMinutes?: number;
  pending?: boolean;
  examDate?: CivilDate | null;
};

export type RankedContent = PriorityItem & {
  score: number;
  rank: number;
  explanation: string;
};

export type PriorityInput = {
  profile: PriorityProfile;
  items: PriorityItem[];
  referenceDate?: CivilDate | null;
};

export function nextPriorityRevision(
  profile: PriorityProfile,
  changes: {
    name?: string;
    weights?: Partial<PriorityWeights>;
    overrides?: Record<string, number>;
  },
): PriorityProfile {
  const { weights, ...rest } = changes;
  return {
    ...profile,
    ...rest,
    weights: { ...profile.weights, ...(weights ?? {}) },
    revision: profile.revision + 1,
  };
}

function daysUntil(reference: CivilDate, examDate: CivilDate): number {
  if (compareCivilDate(examDate, reference) <= 0) return 0;
  let cursor = reference;
  let days = 0;
  // Bounded walk avoids time zone or millisecond rounding entirely.
  while (cursor !== examDate && days < 3650) {
    const [year, month, day] = cursor.split('-').map(Number) as [number, number, number];
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    cursor = next.toISOString().slice(0, 10);
    days += 1;
  }
  return days;
}

/**
 * Deterministic ranking: the same inputs, revisions and policies produce the
 * same order, with ties always broken by the stable content key.
 */
export function rankContent(input: PriorityInput): RankedContent[] {
  const reference = input.referenceDate ?? null;
  const weights = input.profile.weights;
  const maxMinutes = Math.max(
    1,
    ...input.items.map((item) => item.plannedMinutes ?? 0),
  );

  const scored = input.items.map((item) => {
    const override = input.profile.overrides?.[item.contentKey] ?? 1;
    const urgencyDays =
      reference && item.examDate ? daysUntil(reference, item.examDate) : null;
    const urgency =
      urgencyDays === null ? 0 : Math.max(0, Math.min(1, 1 - urgencyDays / 365));
    const depth = 1 / (1 + Math.max(0, item.depth ?? 0));
    const volume = Math.max(0, Math.min(1, (item.plannedMinutes ?? 0) / maxMinutes));
    const pending = item.pending === true ? 1 : 0;

    const raw =
      weights.urgency * urgency +
      weights.depth * depth +
      weights.volume * volume +
      weights.pending * pending;
    const score = Math.round(raw * override * 1000) / 1000;

    const parts: string[] = [];
    if (weights.urgency !== 0 && urgencyDays !== null) {
      parts.push(`urgency=${urgency.toFixed(3)} (${urgencyDays}d)`);
    }
    if (weights.depth !== 0) parts.push(`depth=${depth.toFixed(3)}`);
    if (weights.volume !== 0) parts.push(`volume=${volume.toFixed(3)}`);
    if (weights.pending !== 0) parts.push(`pending=${pending}`);
    if (override !== 1) parts.push(`override=${override}`);

    return {
      ...item,
      score,
      rank: 0,
      explanation: parts.length > 0 ? parts.join(' ') : 'no-weighed-factor',
    };
  });

  scored.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    if (left.contentKey !== right.contentKey) {
      return left.contentKey < right.contentKey ? -1 : 1;
    }
    return 0;
  });

  return scored.map((item, index) => ({ ...item, rank: index + 1 }));
}
