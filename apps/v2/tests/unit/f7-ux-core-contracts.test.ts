import { describe, expect, it } from 'vitest';
import { describeUxEvidence } from '../../src/presentation/ux-evidence';
import {
  resolveRouteEntity,
  routeForTarget,
} from '../../src/presentation/context-navigation';
import { projectAttentionItems } from '../../src/application/attention-projection';
import {
  classifyMaintenanceAction,
  redactDiagnostics,
} from '../../src/presentation/settings-safety';

describe('F7-UX evidence language', () => {
  it('keeps local commit, outbox, ACK, convergence and backup proofs separate', () => {
    const items = describeUxEvidence({
      localCommitted: true,
      outbox: { pending: 2, failed: 0, conflicts: 0 },
      sync: {
        mode: 'READY',
        remoteCommitted: true,
        converged: false,
        verifiedCursor: null,
        conflictCount: 0,
      },
      backup: { status: 'VERIFIED', coverage: 'F2_PARTIAL', preview: 'SAFE' },
      read: { stale: false, partial: false, error: false },
    });

    expect(items.map((item) => item.id)).toEqual([
      'local-commit',
      'outbox-pending',
      'remote-ack',
      'backup-preview',
      'backup-partial',
    ]);
    expect(items.find((item) => item.id === 'local-commit')?.detail).not.toMatch(/sincroniz/i);
    expect(items.find((item) => item.id === 'outbox-pending')?.severity).toBe('info');
    expect(items.find((item) => item.id === 'remote-ack')?.detail).toMatch(/convergência não verificada/i);
    expect(items.find((item) => item.id === 'backup-preview')?.detail).toMatch(/prévia não é restauração/i);
  });

  it('does not turn stale or partial reads into an empty repository', () => {
    const items = describeUxEvidence({
      localCommitted: false,
      outbox: { pending: 0, failed: 0, conflicts: 0 },
      sync: {
        mode: 'PENDING_OFFLINE',
        remoteCommitted: false,
        converged: false,
        verifiedCursor: null,
        conflictCount: 0,
      },
      backup: { status: 'NONE', coverage: 'NONE', preview: 'NONE' },
      read: { stale: true, partial: true, error: false },
    });
    expect(items.find((item) => item.id === 'read-stale')?.detail).toMatch(/não significa ausência/i);
    expect(items.find((item) => item.id === 'read-partial')?.severity).toBe('warning');
  });
});

describe('F7-UX context routes', () => {
  it('carries the exact entity id and validates profile and archive state', () => {
    const route = routeForTarget('sessions', 'session-1');
    expect(route).toMatchObject({ module: 'sessions', entityId: 'session-1' });

    const lookup = (id: string | null) =>
      id === 'session-1'
        ? { id: 'session-1', profileId: 'local-default', status: 'ACTIVE' as const }
        : id === 'session-old'
          ? { id: 'session-old', profileId: 'local-default', status: 'ARCHIVED' as const }
          : id === 'session-other'
            ? { id: 'session-other', profileId: 'other', status: 'ACTIVE' as const }
            : null;

    expect(resolveRouteEntity(route, 'local-default', lookup)).toMatchObject({
      kind: 'found',
      canRead: true,
      canEdit: true,
    });
    expect(resolveRouteEntity(routeForTarget('sessions', 'session-old'), 'local-default', lookup)).toMatchObject({
      kind: 'archived',
      canRead: true,
      canEdit: false,
    });
    expect(resolveRouteEntity(routeForTarget('sessions', 'session-other'), 'local-default', lookup)).toMatchObject({
      kind: 'foreign',
      canRead: false,
    });
    expect(resolveRouteEntity(routeForTarget('sessions', 'missing'), 'local-default', lookup)).toMatchObject({
      kind: 'missing',
      canRead: false,
    });
  });

  it('never includes query payloads or draft text in a target route', () => {
    const route = routeForTarget('reviews', 'review-1');
    expect(route.query).toEqual({ focus: 'review-1' });
    expect(JSON.stringify(route)).not.toMatch(/token|draft|payload/i);
  });
});

describe('F7-UX attention projection', () => {
  it('deduplicates by causal identity and keeps the strongest evidence', () => {
    const projected = projectAttentionItems([
      {
        id: 'render-a',
        causalKey: 'conflict:session-1',
        source: 'home',
        title: 'Conflito',
        detail: 'Versões divergentes',
        severity: 'warning',
        academicEntityId: 'session-1',
        dismissible: false,
      },
      {
        id: 'render-b',
        causalKey: 'conflict:session-1',
        source: 'attention',
        title: 'Conflito',
        detail: 'Versões divergentes aguardam decisão',
        severity: 'critical',
        academicEntityId: 'session-1',
        dismissible: false,
      },
    ]);
    expect(projected.items).toHaveLength(1);
    expect(projected.items[0]).toMatchObject({ id: 'conflict:session-1', severity: 'critical' });
    expect(projected.badgeCount).toBe(1);
  });

  it('dismisses presentation only and never resolves an academic fact', () => {
    const source = [
      {
        id: 'a',
        causalKey: 'review:1',
        source: 'attention',
        title: 'Revisão',
        detail: 'Vencida',
        severity: 'warning' as const,
        academicEntityId: 'review-1',
        dismissible: true,
      },
    ];
    const once = projectAttentionItems(source);
    const twice = projectAttentionItems(source, { dismissedKeys: new Set(['review:1']) });
    expect(once.items).toHaveLength(1);
    expect(twice.items).toHaveLength(0);
    expect(source[0]?.academicEntityId).toBe('review-1');
  });
});

describe('F7-UX settings safety', () => {
  it('blocks destructive cleanup during a blocked upgrade or quota event', () => {
    expect(classifyMaintenanceAction('CLEAR_REGENERABLE_CACHE', { upgradeBlocked: true, quota: false })).toMatchObject({
      allowed: false,
      reason: expect.stringMatching(/atualização/i),
    });
    expect(classifyMaintenanceAction('DELETE_DATABASE', { upgradeBlocked: false, quota: false })).toMatchObject({
      allowed: false,
      reason: expect.stringMatching(/não é oferecido/i),
    });
    expect(classifyMaintenanceAction('CLEAR_REGENERABLE_CACHE', { upgradeBlocked: false, quota: false })).toMatchObject({
      allowed: true,
    });
  });

  it('redacts credentials and account identifiers from diagnostics', () => {
    const safe = redactDiagnostics({
      token: 'secret-token',
      idToken: 'id-token',
      email: 'person@example.test',
      uid: 'google-uid',
      profileId: 'local-default',
      mode: 'READY',
    });
    expect(safe).toEqual({
      token: '[REDACTED]',
      idToken: '[REDACTED]',
      email: '[REDACTED]',
      uid: '[REDACTED]',
      profileId: 'local-default',
      mode: 'READY',
    });
  });
});
