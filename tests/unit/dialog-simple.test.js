import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ui/dialog.js', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.resetModules();
  });

  describe('openModal()', () => {
    it('warns when modal not found', async () => {
      const { openModal } = await import('../../src/js/ui/dialog.js?v=8.34');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      openModal('nonexistent-modal');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
      warnSpy.mockRestore();
    });

    it('shows modal and sets aria-hidden to false', async () => {
      const modal = document.createElement('div');
      modal.id = 'modal-test';
      modal.style.display = 'none';
      document.body.appendChild(modal);

      const { openModal } = await import('../../src/js/ui/dialog.js?v=8.34');
      openModal('modal-test');

      expect(modal.style.display).toBe('flex');
      expect(modal.getAttribute('aria-hidden')).toBe('false');
    });

    it('locks body scroll on first modal', async () => {
      const modal = document.createElement('div');
      modal.id = 'modal-test';
      document.body.appendChild(modal);

      const { openModal } = await import('../../src/js/ui/dialog.js?v=8.34');
      openModal('modal-test');

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('adds modal to stack', async () => {
      const modal = document.createElement('div');
      modal.id = 'modal-test';
      document.body.appendChild(modal);

      const { openModal } = await import('../../src/js/ui/dialog.js?v=8.34');
      openModal('modal-test');
      // Modal should be in stack (body scroll locked indicates this)
      expect(document.body.style.overflow).toBe('hidden');
    });
  });

  describe('closeModal()', () => {
    it('hides modal and sets aria-hidden to true', async () => {
      const modal = document.createElement('div');
      modal.id = 'modal-test';
      modal.style.display = 'flex';
      document.body.appendChild(modal);

      const { openModal, closeModal } = await import('../../src/js/ui/dialog.js?v=8.34');
      openModal('modal-test');
      closeModal('modal-test');

      expect(modal.style.display).toBe('none');
      expect(modal.getAttribute('aria-hidden')).toBe('true');
    });

    it('restores body scroll when last modal closed', async () => {
      const modal = document.createElement('div');
      modal.id = 'modal-test';
      document.body.appendChild(modal);

      const { openModal, closeModal } = await import('../../src/js/ui/dialog.js?v=8.34');
      openModal('modal-test');
      closeModal('modal-test');

      expect(document.body.style.overflow).toBe('');
    });

    it('does nothing when modal not found', async () => {
      const { closeModal } = await import('../../src/js/ui/dialog.js?v=8.34');
      expect(() => closeModal('nonexistent')).not.toThrow();
    });
  });

  describe('initModals()', () => {
    it('sets ARIA attributes on modals', async () => {
      const modal = document.createElement('div');
      modal.id = 'modal-test';
      document.body.appendChild(modal);

      const { initModals } = await import('../../src/js/ui/dialog.js?v=8.34');
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

      const { initModals } = await import('../../src/js/ui/dialog.js?v=8.34');
      initModals();

      expect(modal.getAttribute('aria-labelledby')).toBe('modal-test-title');
    });

    it('handles no modals gracefully', async () => {
      const { initModals } = await import('../../src/js/ui/dialog.js?v=8.34');
      expect(() => initModals()).not.toThrow();
    });
  });

  describe('announce()', () => {
    it('warns when announcer not found', async () => {
      const { announce } = await import('../../src/js/ui/dialog.js?v=8.34');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      announce('Test message');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
      warnSpy.mockRestore();
    });

    it('announces message to screen reader', async () => {
      const announcer = document.createElement('div');
      announcer.id = 'aria-announcer';
      document.body.appendChild(announcer);

      const { announce } = await import('../../src/js/ui/dialog.js?v=8.34');
      announce('Test message');

      expect(announcer.textContent).toBe('Test message');
    });

    it('sets aria-live attribute', async () => {
      const announcer = document.createElement('div');
      announcer.id = 'aria-announcer';
      document.body.appendChild(announcer);

      const { announce } = await import('../../src/js/ui/dialog.js?v=8.34');
      announce('Test message', 'assertive');

      expect(announcer.getAttribute('aria-live')).toBe('assertive');
    });
  });
});
