import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GoogleLink } from '../../src/presentation/components/GoogleLink';

describe('F7 GoogleLink diagnostics', () => {
  it('f7_google_link_renders_only_the_sanitized_auth_code', () => {
    const html = renderToStaticMarkup(
      createElement(GoogleLink, {
        status: 'LOCAL_ONLY',
        authError: 'auth/popup-blocked',
      }),
    );
    expect(html).toContain('data-google-auth-error');
    expect(html).toContain('auth/popup-blocked');
    expect(html).toContain('O navegador bloqueou o popup');
    expect(html).not.toContain('<script');
  });

  it('f7_google_link_hides_the_alert_without_an_error', () => {
    const html = renderToStaticMarkup(
      createElement(GoogleLink, {
        status: 'LOCAL_ONLY',
        authError: null,
      }),
    );
    expect(html).not.toContain('data-google-auth-error');
  });
});
