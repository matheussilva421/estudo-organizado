import { describe, expect, it } from 'vitest';
import {
  appendRetaFinalDraftOperation,
  createRetaFinalDraft,
} from '../../src/js/logic/reta-final-drafts.js';
import {
  discardRetaFinalDraft,
  loadRetaFinalDraft,
  saveRetaFinalDraft,
} from '../../src/js/store/reta-final-draft-store.js';
import { createTransactionalIdb } from './reta-final-draft-idb-helper.js';

const initialStores = {
  app_state: {
    main_state_current: { payload: { planejamento: { tipo: 'ciclo' } } },
  },
  reta_final_drafts: {},
  reta_final_journal: {},
};

function plan() {
  return {
    tipo: 'reta_final',
    planId: 'plan-1',
    schemaVersionRetaFinal: 2,
    revision: 4,
    retaFinal: {
      dataFinal: '2026-11-30',
      blocos: [
        {
          id: 'rf-1',
          discId: 'disc-1',
          topicos: [{ assId: 'ass-1', aulaId: null }],
          minutos: 60,
          status: 'pendente',
          ordem: 0,
          dataOriginal: '2026-10-20',
          dataPlanejada: '2026-10-20',
          data: '2026-10-20',
          rolagens: 0,
        },
      ],
    },
  };
}

function draft(draftId = 'draft-1') {
  return createRetaFinalDraft(plan(), {
    draftId,
    now: '2026-10-20T12:00:00.000Z',
  });
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('Reta Final draft IndexedDB store', () => {
  it('resolves save only after the IndexedDB transaction completes', async () => {
    const gate = deferred();
    const idb = createTransactionalIdb({
      stores: initialStores,
      commitGate: gate.promise,
    });
    let settled = false;
    const saving = saveRetaFinalDraft(idb.database, draft()).then(() => {
      settled = true;
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(idb.getRecord('reta_final_drafts', 'draft-1')).toBeUndefined();

    gate.resolve();
    await saving;
    expect(settled).toBe(true);
    expect(idb.getRecord('reta_final_drafts', 'draft-1').state).toBe('editing');
  });

  it('reloads the same editing draft from a reopened database connection', async () => {
    const idb = createTransactionalIdb({ stores: initialStores });
    await saveRetaFinalDraft(idb.database, draft());

    const loaded = await loadRetaFinalDraft(idb.reopen(), 'draft-1');

    expect(loaded).toEqual(draft());
    expect(loaded.state).toBe('editing');
  });

  it('preserves an edited draft and its operation log across database reopen', async () => {
    const idb = createTransactionalIdb({ stores: initialStores });
    const original = draft();
    const edited = appendRetaFinalDraftOperation(
      original,
      {
        operationId: 'op-1',
        type: 'PATCH',
        blockIds: ['rf-1'],
        patch: { minutos: 90 },
      },
      { events: [], catalog: [], today: '2026-10-20' },
    );
    expect(edited.valid).toBe(true);
    await saveRetaFinalDraft(idb.database, edited.draft);

    const loaded = await loadRetaFinalDraft(idb.reopen(), 'draft-1');

    expect(loaded.operations).toHaveLength(1);
    expect(loaded.operations[0].operationId).toBe('op-1');
    expect(loaded.snapshot.retaFinal.blocos[0].minutos).toBe(90);
    expect(loaded.state).toBe('editing');
  });

  it('returns null when the requested draft does not exist', async () => {
    const idb = createTransactionalIdb({ stores: initialStores });

    await expect(
      loadRetaFinalDraft(idb.database, 'missing'),
    ).resolves.toBeNull();
  });

  it('rejects quota errors instead of reporting a successful save', async () => {
    const idb = createTransactionalIdb({ stores: initialStores });
    idb.failNextWrite();

    await expect(
      saveRetaFinalDraft(idb.database, draft()),
    ).rejects.toMatchObject({
      name: 'QuotaExceededError',
    });
    expect(idb.getRecord('reta_final_drafts', 'draft-1')).toBeUndefined();
  });

  it('rejects an interrupted transaction and keeps the last committed draft on reopen', async () => {
    const idb = createTransactionalIdb({ stores: initialStores });
    const original = draft();
    await saveRetaFinalDraft(idb.database, original);
    const replacement = { ...original, updatedAt: '2026-10-21T12:00:00.000Z' };
    const saving = saveRetaFinalDraft(idb.database, replacement);
    idb.lastTransaction.abort();

    await expect(saving).rejects.toMatchObject({ name: 'AbortError' });
    await expect(loadRetaFinalDraft(idb.reopen(), 'draft-1')).resolves.toEqual(
      original,
    );
  });

  it('rejects when no usable database instance is supplied', async () => {
    await expect(loadRetaFinalDraft(null, 'draft-1')).rejects.toThrow();
    await expect(saveRetaFinalDraft(undefined, draft())).rejects.toThrow();
    await expect(discardRetaFinalDraft(null, 'draft-1')).rejects.toThrow();
  });

  it('discard deletes only the draft and preserves official app state', async () => {
    const idb = createTransactionalIdb({ stores: initialStores });
    await saveRetaFinalDraft(idb.database, draft());
    const officialBefore = idb.getRecord('app_state', 'main_state_current');

    await discardRetaFinalDraft(idb.database, 'draft-1');

    expect(idb.getRecord('reta_final_drafts', 'draft-1')).toBeUndefined();
    expect(idb.getRecord('app_state', 'main_state_current')).toEqual(
      officialBefore,
    );
    await expect(
      loadRetaFinalDraft(idb.reopen(), 'draft-1'),
    ).resolves.toBeNull();
  });
});
