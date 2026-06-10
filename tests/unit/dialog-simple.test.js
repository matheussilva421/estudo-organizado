import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ui/dialog.js', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.resetModules();
  });

  describe('openModal()', () => {
    it('returns silently when modal not found', async () => {
      const { openModal } = await import('../../src/js/ui/dialog.js?v=8.37');
      expect(() => openModal('nonexistent-modal')).not.toThrow();
    });

    it('shows modal via .open class and sets aria-hidden to false', async () => {
      const modal = document.createElement('div');
      modal.id = 'modal-test';
      document.body.appendChild(modal);

      const { openModal } = await import('../../src/js/ui/dialog.js?v=8.37');
      openModal('modal-test');

      // contrato visual do CSS é a classe .open (não style.display)
      expect(modal.classList.contains('open')).toBe(true);
      expect(modal.getAttribute('aria-hidden')).toBe('false');
    });

    it('locks body scroll on first modal', async () => {
      const modal = document.createElement('div');
      modal.id = 'modal-test';
      document.body.appendChild(modal);

      const { openModal } = await import('../../src/js/ui/dialog.js?v=8.37');
      openModal('modal-test');

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('adds modal to stack', async () => {
      const modal = document.createElement('div');
      modal.id = 'modal-test';
      document.body.appendChild(modal);

      const { openModal } = await import('../../src/js/ui/dialog.js?v=8.37');
      openModal('modal-test');
      // Modal should be in stack (body scroll locked indicates this)
      expect(document.body.style.overflow).toBe('hidden');
    });
  });

  describe('closeModal()', () => {
    it('hides modal (remove .open) and sets aria-hidden to true', async () => {
      const modal = document.createElement('div');
      modal.id = 'modal-test';
      document.body.appendChild(modal);

      const { openModal, closeModal } = await import('../../src/js/ui/dialog.js?v=8.37');
      openModal('modal-test');
      closeModal('modal-test');

      expect(modal.classList.contains('open')).toBe(false);
      expect(modal.getAttribute('aria-hidden')).toBe('true');
    });

    it('restores body scroll when last modal closed', async () => {
      const modal = document.createElement('div');
      modal.id = 'modal-test';
      document.body.appendChild(modal);

      const { openModal, closeModal } = await import('../../src/js/ui/dialog.js?v=8.37');
      openModal('modal-test');
      closeModal('modal-test');

      expect(document.body.style.overflow).toBe('');
    });

    it('does nothing when modal not found', async () => {
      const { closeModal } = await import('../../src/js/ui/dialog.js?v=8.37');
      expect(() => closeModal('nonexistent')).not.toThrow();
    });
  });

  describe('initModals()', () => {
    it('sets ARIA attributes on modals', async () => {
      const modal = document.createElement('div');
      modal.id = 'modal-test';
      document.body.appendChild(modal);

      const { initModals } = await import('../../src/js/ui/dialog.js?v=8.37');
      initModals();

      expect(modal.getAttribute('role')).toBe('dialog');
      expect(modal.getAttribute('aria-modal')).toBe('true');
      expect(modal.getAttribute('aria-hidden')).toBe('true');
    });

    it('sets aria-labelledby when title exists', async () => {
      const modal = document.createElement('div');
      modal.id = 'modal-test';
      const title = document.createElement('h2');
      title.id = 'modal-test-title';
      modal.appendChild(title);
      document.body.appendChild(modal);

      const { initModals } = await import('../../src/js/ui/dialog.js?v=8.37');
      initModals();

      expect(modal.getAttribute('aria-labelledby')).toBe('modal-test-title');
    });

    it('handles no modals gracefully', async () => {
      const { initModals } = await import('../../src/js/ui/dialog.js?v=8.37');
      expect(() => initModals()).not.toThrow();
    });
  });

  describe('announce()', () => {
    it('returns silently when announcer not found', async () => {
      const { announce } = await import('../../src/js/ui/dialog.js?v=8.37');
      expect(() => announce('Test message')).not.toThrow();
    });

    it('announces message to screen reader', async () => {
      const announcer = document.createElement('div');
      announcer.id = 'aria-announcer';
      document.body.appendChild(announcer);

      const { announce } = await import('../../src/js/ui/dialog.js?v=8.37');
      announce('Test message');

      expect(announcer.textContent).toBe('Test message');
    });

    it('sets aria-live attribute', async () => {
      const announcer = document.createElement('div');
      announcer.id = 'aria-announcer';
      document.body.appendChild(announcer);

      const { announce } = await import('../../src/js/ui/dialog.js?v=8.37');
      announce('Test message', 'assertive');

      expect(announcer.getAttribute('aria-live')).toBe('assertive');
    });
  });
});
