import {
  buildAnalytics,
  type AnalyticsInput,
  type AnalyticsSummary,
} from './experience-queries';

/**
 * Non-authoritative projection cache. Keys include profile, period and every
 * input revision that can change the result. A cache hit is never a fact: the
 * caller must clear it when committed inputs change.
 */
export class ExperienceProjectionCache {
  private readonly entries = new Map<string, AnalyticsSummary>();

  get(key: string): AnalyticsSummary | undefined {
    return this.entries.get(key);
  }

  set(key: string, value: AnalyticsSummary): void {
    this.entries.set(key, value);
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}

function hash(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16).padStart(8, '0');
}

export function analyticsFingerprint(
  input: AnalyticsInput,
  today: string,
  days = 30,
): string {
  const parts = [
    input.profileId,
    today,
    String(days),
    String(input.sessionConflicts ?? 0),
    input.content.editais
      .map((edital) => [edital.id, edital.localRevision, edital.status].join(':'))
      .sort()
      .join(','),
    input.content.links
      .map((link) => [link.id, link.localRevision, link.status].join(':'))
      .sort()
      .join(','),
    input.scenarios
      .map((scenario) => [scenario.id, scenario.localRevision, scenario.status].join(':'))
      .sort()
      .join(','),
    input.blocks
      .map((block) =>
        [block.id, block.localRevision, block.plannedMinutes, block.civilDate ?? ''].join(':'),
      )
      .sort()
      .join(','),
    input.sessions
      .map((session) =>
        [
          session.id,
          session.state,
          session.localRevision,
          session.recordedAtCivilDate ?? '',
          session.manualDeclaredMs ?? 0,
          session.intervals.map((interval) => interval.verifiedMs).join('.'),
        ].join(':'),
      )
      .sort()
      .join(','),
  ];
  return hash(parts.join('|'));
}

export function cachedAnalytics(
  cache: ExperienceProjectionCache,
  input: AnalyticsInput,
  today: string,
  days = 30,
): AnalyticsSummary {
  const key = analyticsFingerprint(input, today, days);
  const cached = cache.get(key);
  if (cached) return cached;
  const value = { ...buildAnalytics(input, today, days), fingerprint: key };
  cache.set(key, value);
  return value;
}

