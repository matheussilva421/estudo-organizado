import { describe, expect, it } from 'vitest';
import { qsa } from '../../src/js/ui/dom.js?v=8.26';

describe('ui/dom.js', () => {
  it('qsa falls back to the raw selector when normalized ID lookup is empty', () => {
    document.body.innerHTML = `
      <section>
        <button data-action="save-disc">Salvar</button>
        <button data-action="save-disc">Salvar outro</button>
      </section>
    `;

    const matches = qsa('[data-action="save-disc"]');

    expect(matches).toHaveLength(2);
  });
});
