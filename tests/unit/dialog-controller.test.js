import { describe, it, expect, vi, beforeEach } from 'vitest';

// ui/dialog.js é o controller único de modais: contrato visual por classe
// `.open` (mesmo do CSS de .modal-overlay), pilha, focus trap (Tab/Shift+Tab)
// e restauração de foco por modal. Escape NÃO é tratado aqui — o handler
// global (ui/search.js) é o dono, pois conhece o caso do modal-confirm.
describe('ui/dialog.js — controller único de modais', () => {
  let dialog;

  beforeEach(async () => {
    vi.resetModules();
    dialog = await import('../../src/js/ui/dialog.js?v=8.37');
    document.body.innerHTML = `
      <button id="opener">abrir</button>
      <div id="modal-a" class="modal-overlay">
        <button id="a1">um</button>
        <button id="a2">dois</button>
      </div>
      <div id="modal-b" class="modal-overlay">
        <button id="b1">um</button>
      </div>
    `;
    document.body.style.overflow = '';
  });

  it('openModal usa a classe .open (contrato do CSS), aria-hidden e trava o scroll', () => {
    dialog.openModal('modal-a');
    const modal = document.getElementById('modal-a');
    expect(modal.classList.contains('open')).toBe(true);
    expect(modal.getAttribute('aria-hidden')).toBe('false');
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('closeModal desfaz classe/aria, libera o scroll e devolve o foco a quem abriu', () => {
    document.getElementById('opener').focus();
    dialog.openModal('modal-a');
    document.getElementById('a1').focus();

    dialog.closeModal('modal-a');

    const modal = document.getElementById('modal-a');
    expect(modal.classList.contains('open')).toBe(false);
    expect(modal.getAttribute('aria-hidden')).toBe('true');
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement.id).toBe('opener');
  });

  it('Tab no último focável cicla para o primeiro (focus trap)', () => {
    dialog.openModal('modal-a');
    document.getElementById('a2').focus();

    document.getElementById('modal-a').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
    );

    expect(document.activeElement.id).toBe('a1');
  });

  it('Shift+Tab no primeiro focável cicla para o último', () => {
    dialog.openModal('modal-a');
    document.getElementById('a1').focus();

    document.getElementById('modal-a').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })
    );

    expect(document.activeElement.id).toBe('a2');
  });

  it('Escape no modal NÃO fecha aqui (handler global é o dono)', () => {
    dialog.openModal('modal-a');
    document.getElementById('modal-a').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    expect(document.getElementById('modal-a').classList.contains('open')).toBe(true);
  });

  it('modais empilhados: scroll continua travado e foco volta ao nível anterior', () => {
    document.getElementById('opener').focus();
    dialog.openModal('modal-a');
    document.getElementById('a1').focus();
    dialog.openModal('modal-b');
    document.getElementById('b1').focus();

    dialog.closeModal('modal-b');
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.activeElement.id).toBe('a1');

    dialog.closeModal('modal-a');
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement.id).toBe('opener');
  });

  it('fechar modal não interfere no trap de outro reaberto (handlers limpos)', () => {
    dialog.openModal('modal-a');
    dialog.closeModal('modal-a');
    dialog.openModal('modal-a');
    document.getElementById('a2').focus();

    document.getElementById('modal-a').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
    );

    // um trap único ativo: foco cicla exatamente para o primeiro
    expect(document.activeElement.id).toBe('a1');
  });
});
