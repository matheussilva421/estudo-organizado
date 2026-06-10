import { describe, it, expect, beforeEach } from 'vitest';
import { openModal, closeModal } from '../../src/js/app/modals.js';

// Usuários de teclado/leitores de tela perdem a posição quando o modal fecha e
// o foco cai no <body>. closeModal deve devolver o foco a quem abriu o modal.
describe('app/modals.js — restauração de foco', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="opener">Abrir</button>
      <div id="m1" class="modal-overlay"><button id="inside">Ok</button></div>
      <div id="m2" class="modal-overlay"><button id="inside2">Ok</button></div>
    `;
  });

  it('devolve o foco ao elemento que abriu o modal', () => {
    document.getElementById('opener').focus();
    openModal('m1');
    document.getElementById('inside').focus();

    closeModal('m1');

    expect(document.activeElement.id).toBe('opener');
  });

  it('não quebra se o elemento de origem saiu do DOM (re-render)', () => {
    document.getElementById('opener').focus();
    openModal('m1');
    document.getElementById('opener').remove();

    expect(() => closeModal('m1')).not.toThrow();
  });

  it('modais empilhados devolvem o foco para o nível anterior', () => {
    document.getElementById('opener').focus();
    openModal('m1');
    const inside = document.getElementById('inside');
    inside.focus();
    openModal('m2');
    document.getElementById('inside2').focus();

    closeModal('m2');
    expect(document.activeElement.id).toBe('inside');

    closeModal('m1');
    expect(document.activeElement.id).toBe('opener');
  });
});
