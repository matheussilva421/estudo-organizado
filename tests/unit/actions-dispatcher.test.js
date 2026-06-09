import { beforeEach, describe, expect, it, vi } from 'vitest';

let dispatcher;

beforeEach(async () => {
  vi.resetModules();

  const listeners = {};
  global.document = {
    addEventListener: vi.fn((event, handler) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    }),
  };
  global._listeners = listeners;

  dispatcher = await import('../../src/js/ui/actions/dispatcher.js?v=8.37');
});

describe('dispatcher.js', () => {
  describe('registerAction', () => {
    it('registers a handler by name', () => {
      const handler = vi.fn();
      dispatcher.registerAction('test-action', handler);
      expect(dispatcher.actions['test-action']).toBe(handler);
    });

    it('overwrites existing action', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      dispatcher.registerAction('dup', h1);
      dispatcher.registerAction('dup', h2);
      expect(dispatcher.actions['dup']).toBe(h2);
    });
  });

  describe('setupActionDispatcher', () => {
    it('registers click, change, input, keydown, focusin, focusout listeners', () => {
      dispatcher.setupActionDispatcher();
      const calls = global.document.addEventListener.mock.calls.map((c) => c[0]);
      expect(calls).toContain('click');
      expect(calls).toContain('change');
      expect(calls).toContain('input');
      expect(calls).toContain('keydown');
      expect(calls).toContain('focusin');
      expect(calls).toContain('focusout');
    });
  });

  describe('action dispatching', () => {
    it('calls handler on click and prevents default', () => {
      const handler = vi.fn();
      dispatcher.registerAction('click-action', handler);
      dispatcher.setupActionDispatcher();

      const target = {
        tagName: 'BUTTON',
        dataset: { action: 'click-action' },
        closest: vi.fn(function () { return this; }),
      };
      const event = { target, preventDefault: vi.fn(), stopPropagation: vi.fn() };

      const clickHandler = global._listeners['click'][0];
      clickHandler(event);

      expect(handler).toHaveBeenCalledWith(target, event);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('does not prevent default on SELECT elements', () => {
      const handler = vi.fn();
      dispatcher.registerAction('select-action', handler);
      dispatcher.setupActionDispatcher();

      const target = {
        tagName: 'SELECT',
        dataset: { action: 'select-action' },
        closest: vi.fn(function () { return this; }),
      };
      const event = { target, preventDefault: vi.fn() };

      const clickHandler = global._listeners['click'][0];
      clickHandler(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('warns when action not found', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      dispatcher.setupActionDispatcher();

      const target = {
        tagName: 'BUTTON',
        dataset: { action: 'missing-action' },
        closest: vi.fn(function () { return this; }),
      };
      const event = { target, preventDefault: vi.fn(), stopPropagation: vi.fn() };

      global._listeners['click'][0](event);
      expect(spy).toHaveBeenCalledWith('[actions.js] Action "missing-action" not found');
      spy.mockRestore();
    });

    it('handles change events', () => {
      const handler = vi.fn();
      dispatcher.registerAction('change-action', handler);
      dispatcher.setupActionDispatcher();

      const target = {
        tagName: 'INPUT',
        dataset: { action: 'change-action' },
        closest: vi.fn(function () { return this; }),
      };
      const event = { target, preventDefault: vi.fn(), stopPropagation: vi.fn() };

      global._listeners['change'][0](event);
      expect(handler).toHaveBeenCalledWith(target, event);
    });

    it('handles input events without preventDefault', () => {
      const handler = vi.fn();
      dispatcher.registerAction('input-action', handler);
      dispatcher.setupActionDispatcher();

      const target = {
        tagName: 'INPUT',
        dataset: { action: 'input-action' },
        closest: vi.fn(function () { return this; }),
      };
      const event = { target, preventDefault: vi.fn() };

      global._listeners['input'][0](event);
      expect(handler).toHaveBeenCalledWith(target, event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('handles focus events via data-focus-action', () => {
      const handler = vi.fn();
      dispatcher.registerAction('focus-action', handler);
      dispatcher.setupActionDispatcher();

      const target = {
        tagName: 'INPUT',
        dataset: { focusAction: 'focus-action' },
        closest: vi.fn(function () { return this; }),
      };
      const event = { target };

      global._listeners['focusin'][0](event);
      expect(handler).toHaveBeenCalledWith(target, event);
    });

    it('handles blur events via data-blur-action', () => {
      const handler = vi.fn();
      dispatcher.registerAction('blur-action', handler);
      dispatcher.setupActionDispatcher();

      const target = {
        tagName: 'INPUT',
        dataset: { blurAction: 'blur-action' },
        closest: vi.fn(function () { return this; }),
      };
      const event = { target };

      global._listeners['focusout'][0](event);
      expect(handler).toHaveBeenCalledWith(target, event);
    });

    it('ignores elements without data-action', () => {
      dispatcher.setupActionDispatcher();
      const target = { tagName: 'DIV', dataset: {}, closest: vi.fn(() => null) };
      const event = { target, preventDefault: vi.fn() };
      expect(() => global._listeners['click'][0](event)).not.toThrow();
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('ignores elements without data-action on change', () => {
      dispatcher.setupActionDispatcher();
      const target = { tagName: 'INPUT', dataset: {}, closest: vi.fn(() => null) };
      const event = { target, preventDefault: vi.fn() };
      expect(() => global._listeners['change'][0](event)).not.toThrow();
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('ignores elements without data-action on input', () => {
      dispatcher.setupActionDispatcher();
      const target = { tagName: 'INPUT', dataset: {}, closest: vi.fn(() => null) };
      const event = { target, preventDefault: vi.fn() };
      expect(() => global._listeners['input'][0](event)).not.toThrow();
    });

    it('ignores elements without data-focus-action on focusin', () => {
      dispatcher.setupActionDispatcher();
      const target = { tagName: 'INPUT', dataset: {}, closest: vi.fn(() => null) };
      const event = { target };
      expect(() => global._listeners['focusin'][0](event)).not.toThrow();
    });

    it('ignores elements without data-blur-action on focusout', () => {
      dispatcher.setupActionDispatcher();
      const target = { tagName: 'INPUT', dataset: {}, closest: vi.fn(() => null) };
      const event = { target };
      expect(() => global._listeners['focusout'][0](event)).not.toThrow();
    });
  });

  describe('keyboard activation of role=button elements', () => {
    function makeRoleButtonTarget(action, tagName = 'DIV', role = 'button') {
      return {
        tagName,
        dataset: { action },
        getAttribute: vi.fn((name) => (name === 'role' ? role : null)),
        closest: vi.fn(function () { return this; }),
      };
    }

    it('activates [role=button] div on Enter keydown', () => {
      const handler = vi.fn();
      dispatcher.registerAction('kb-action', handler);
      dispatcher.setupActionDispatcher();

      const target = makeRoleButtonTarget('kb-action');
      const event = { key: 'Enter', target, preventDefault: vi.fn(), stopPropagation: vi.fn() };

      global._listeners['keydown'][0](event);
      expect(handler).toHaveBeenCalledWith(target, event);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('activates [role=button] div on Space keydown', () => {
      const handler = vi.fn();
      dispatcher.registerAction('kb-action-space', handler);
      dispatcher.setupActionDispatcher();

      const target = makeRoleButtonTarget('kb-action-space');
      const event = { key: ' ', target, preventDefault: vi.fn(), stopPropagation: vi.fn() };

      global._listeners['keydown'][0](event);
      expect(handler).toHaveBeenCalledWith(target, event);
    });

    it('does not double-activate native buttons on keydown', () => {
      const handler = vi.fn();
      dispatcher.registerAction('kb-native', handler);
      dispatcher.setupActionDispatcher();

      const target = makeRoleButtonTarget('kb-native', 'BUTTON');
      const event = { key: 'Enter', target, preventDefault: vi.fn(), stopPropagation: vi.fn() };

      global._listeners['keydown'][0](event);
      expect(handler).not.toHaveBeenCalled();
    });

    it('ignores keydown on elements without role=button', () => {
      const handler = vi.fn();
      dispatcher.registerAction('kb-norole', handler);
      dispatcher.setupActionDispatcher();

      const target = makeRoleButtonTarget('kb-norole', 'DIV', null);
      const event = { key: 'Enter', target, preventDefault: vi.fn(), stopPropagation: vi.fn() };

      global._listeners['keydown'][0](event);
      expect(handler).not.toHaveBeenCalled();
    });

    it('ignores other keys', () => {
      const handler = vi.fn();
      dispatcher.registerAction('kb-otherkey', handler);
      dispatcher.setupActionDispatcher();

      const target = makeRoleButtonTarget('kb-otherkey');
      const event = { key: 'a', target, preventDefault: vi.fn(), stopPropagation: vi.fn() };

      global._listeners['keydown'][0](event);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('actions export', () => {
    it('exports actions object', () => {
      expect(typeof dispatcher.actions).toBe('object');
    });
  });
});
