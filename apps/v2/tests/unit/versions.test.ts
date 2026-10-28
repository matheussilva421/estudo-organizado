import { describe, expect, it } from 'vitest';
import {
  APP_VERSION,
  BACKUP_FORMAT_VERSION,
  DOMAIN_SCHEMA_VERSION,
  LOCAL_DB_VERSION,
  SYNC_PROTOCOL_VERSION,
} from '../../src/domain/versions';

describe('V2 version constants', () => {
  it('independent_version_constants', () => {
    for (const value of [
      DOMAIN_SCHEMA_VERSION,
      LOCAL_DB_VERSION,
      BACKUP_FORMAT_VERSION,
      SYNC_PROTOCOL_VERSION,
    ]) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
    expect(SYNC_PROTOCOL_VERSION).toBe(1);
    expect(BACKUP_FORMAT_VERSION).toBe(1);
    expect(APP_VERSION).toBe('0.1.0');
  });

  it('does_not_reuse_v1_schema_numbers', () => {
    expect(DOMAIN_SCHEMA_VERSION).not.toBe(12);
    expect(LOCAL_DB_VERSION).not.toBe(7);
  });
});
