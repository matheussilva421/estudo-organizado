import { describe, expect, it } from 'vitest';
import { verifyStagingReadiness, type StagingReadiness } from '../../src/platform/staging-readiness';

const ready: StagingReadiness = {
  buildSha: '6c70fef',
  url: 'https://v2-f7.example.pages.dev',
  isolatedOrigin: true,
  isolatedFirebase: true,
  v1Unaffected: true,
  criticalTestsPassed: true,
  liveReadback: true,
  testDataOnly: true,
  usesPaidServices: false,
  modules: ['F2', 'F3', 'F4', 'F5', 'F6'],
  unverified: [],
};

describe('F7 staging readiness', () => {
  it('f7_staging_url_must_differ_from_v1', () => {
    expect(verifyStagingReadiness({ ...ready, url: 'https://estudo-organizado.matheussilva421.workers.dev' })).toBe('BLOCKED');
    expect(verifyStagingReadiness({ ...ready, url: 'https://app-de-estudos-14564.web.app' })).toBe('BLOCKED');
  });

  it('f7_staging_does_not_touch_v1_sw_idb_or_firebase', () => {
    expect(verifyStagingReadiness({ ...ready, isolatedOrigin: false })).toBe('BLOCKED');
    expect(verifyStagingReadiness({ ...ready, isolatedFirebase: false })).toBe('BLOCKED');
    expect(verifyStagingReadiness({ ...ready, v1Unaffected: false })).toBe('BLOCKED');
  });

  it('f7_staging_uses_only_test_data', () => {
    expect(verifyStagingReadiness({ ...ready, testDataOnly: false })).toBe('BLOCKED');
  });

  it('f7_staging_candidate_integrates_f2_to_f6', () => {
    expect(verifyStagingReadiness({ ...ready, modules: ['F2', 'F3'] })).toBe('BLOCKED');
  });

  it('f7_staging_does_not_claim_ready_without_live_readback', () => {
    expect(verifyStagingReadiness({ ...ready, liveReadback: false })).toBe('BLOCKED');
  });

  it('f7_staging_blocks_paid_services', () => {
    expect(verifyStagingReadiness({ ...ready, usesPaidServices: true })).toBe('BLOCKED');
    expect(verifyStagingReadiness(ready)).toBe('READY_FOR_HUMAN_REVIEW');
  });
});
