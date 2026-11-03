import { describe, expect, it } from 'vitest';
import {
  ExperienceProjectionCache,
  analyticsFingerprint,
  cachedAnalytics,
} from '../../src/application/experience-cache';
import type { AnalyticsInput } from '../../src/application/experience-queries';
import type { ContentSnapshot } from '../../src/application/content-service';
import type { StudySession } from '../../src/domain/session';

const TODAY = '2026-11-03';
const PROFILE = 'p1';

function input(): AnalyticsInput {
  const content: ContentSnapshot = {
    subjects: [],
    editais: [
      { id: 'e1', profileId: PROFILE, title: 'TRT', status: 'ACTIVE', localRevision: 1 },
    ],
    links: [],
    assuntos: [],
    aulas: [],
    lessonTopics: [],
  };
  const sessions: StudySession[] = [
    {
      id: 's1',
      profileId: PROFILE,
      state: 'COMPLETED',
      origin: 'TIMER',
      localRevision: 1,
      schemaVersion: 1,
      referenceZone: 'America/Fortaleza',
      recordedAtCivilDate: TODAY,
      planBlockIds: [],
      editalIds: ['e1'],
      intervals: [
        {
          id: 'i1',
          kind: 'FOCUS',
          verifiedMs: 60000,
          contextId: null,
          checkpoint: null,
          recoveryFlag: false,
        },
      ],
    },
  ];
  return { profileId: PROFILE, content, scenarios: [], blocks: [], sessions };
}

describe('f6 projection cache', () => {
  it('returns the same non-authoritative projection for the same fingerprint', () => {
    const cache = new ExperienceProjectionCache();
    const first = cachedAnalytics(cache, input(), TODAY);
    const second = cachedAnalytics(cache, input(), TODAY);
    expect(second).toBe(first);
    expect(cache.size).toBe(1);
  });

  it('changes the key when a committed input revision changes', () => {
    const base = input();
    const changed = input();
    changed.sessions = changed.sessions.map((session) => ({
      ...session,
      localRevision: session.localRevision + 1,
    }));
    expect(analyticsFingerprint(base, TODAY)).not.toBe(
      analyticsFingerprint(changed, TODAY),
    );
    const cache = new ExperienceProjectionCache();
    cachedAnalytics(cache, base, TODAY);
    cachedAnalytics(cache, changed, TODAY);
    expect(cache.size).toBe(2);
  });

  it('clears explicitly and scopes the fingerprint by profile', () => {
    const cache = new ExperienceProjectionCache();
    cachedAnalytics(cache, input(), TODAY);
    cache.clear();
    expect(cache.size).toBe(0);
    const other = input();
    other.profileId = 'p2';
    expect(analyticsFingerprint(input(), TODAY)).not.toBe(
      analyticsFingerprint(other, TODAY),
    );
  });
});

