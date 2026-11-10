import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RecoveryPanel } from '../../src/presentation/components/RecoveryPanel';

describe('F7 recovery view', () => {
  it('does not show a stale success state when a new marker exists', () => {
    const markup = renderToStaticMarkup(
      createElement(RecoveryPanel, {
        recovery: { reason: 'NEW_RESTORE', at: '2026-11-10T10:00:00.000Z' },
        status: 'RECUPERADO',
        preview: null,
        onPrepare: () => undefined,
        onExport: () => undefined,
        onConfirm: () => undefined,
      }),
    );
    expect(markup).not.toContain('data-recovery-status="RECUPERADO"');
    expect(markup).toContain('Verificar recuperação');
  });

  it('shows the verified success only when the marker is gone', () => {
    const markup = renderToStaticMarkup(
      createElement(RecoveryPanel, {
        recovery: null,
        status: 'RECUPERADO',
        preview: null,
        onPrepare: () => undefined,
        onExport: () => undefined,
        onConfirm: () => undefined,
      }),
    );
    expect(markup).toContain('data-recovery-status="RECUPERADO"');
  });
});
