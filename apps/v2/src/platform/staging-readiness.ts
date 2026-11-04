export type StagingReadiness = {
  buildSha: string;
  url: string;
  isolatedOrigin: boolean;
  isolatedFirebase: boolean;
  v1Unaffected: boolean;
  criticalTestsPassed: boolean;
  liveReadback: boolean;
  testDataOnly: boolean;
  usesPaidServices: boolean;
  modules: string[];
  unverified: string[];
};

export type StagingDecision = 'READY_FOR_HUMAN_REVIEW' | 'BLOCKED';

const V1_HOSTS = [
  'app-de-estudos-14564.firebaseapp.com',
  'app-de-estudos-14564.web.app',
  'estudo-organizado.matheussilva421.workers.dev',
];

function isV1Url(value: string): boolean {
  const lower = value.trim().toLowerCase();
  if (!lower) return true;
  if (lower.includes('app-de-estudos-14564')) return true;
  try {
    const url = new URL(lower);
    return V1_HOSTS.includes(url.hostname);
  } catch {
    return true;
  }
}

/**
 * A local configuration can prove isolation, but only a real HTTP read-back
 * after G-STAGING can prove the URL is reachable. Missing proof is BLOCKED.
 */
export function verifyStagingReadiness(input: StagingReadiness): StagingDecision {
  if (!input || typeof input !== 'object') return 'BLOCKED';
  if (!input.buildSha.trim() || !input.url.trim()) return 'BLOCKED';
  if (isV1Url(input.url)) return 'BLOCKED';
  if (!input.isolatedOrigin || !input.isolatedFirebase || !input.v1Unaffected) return 'BLOCKED';
  if (!input.criticalTestsPassed || !input.liveReadback) return 'BLOCKED';
  if (!input.testDataOnly || input.usesPaidServices) return 'BLOCKED';
  if (input.unverified.length > 0) return 'BLOCKED';
  const required = ['F2', 'F3', 'F4', 'F5', 'F6'];
  if (!required.every((module) => input.modules.includes(module))) return 'BLOCKED';
  return 'READY_FOR_HUMAN_REVIEW';
}
