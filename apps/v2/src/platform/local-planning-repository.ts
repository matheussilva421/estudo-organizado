import type {
  PlanBlock,
  PlanningOutcome,
  PlanningScenario,
  PlanningScenarioSnapshot,
} from '../domain/planning';
import { validatePlanBlock, validateScenario, PlanningValidationError } from '../domain/planning';
import type {
  PlanningActivationInput,
  PlanningCommit,
  PlanningDraft,
  PlanningOperationRecord,
  PlanningRepository,
} from '../application/planning-service';
import { PLANNING_ENTITY_SCHEMA_VERSION } from '../application/planning-service';
import {
  openV2Database,
  requestResult,
  STORES,
  toLocalPersistenceError,
  transactionDone,
} from './indexeddb';
import { notifyPlanningChange } from './local-events';

type Fault = 'abort' | 'quota' | null;

export type PlanningRepositoryOptions = {
  fault?: Fault;
  now?: () => string;
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
  return `{${entries.join(',')}}`;
}

function normalizeCommit(input: PlanningCommit): Record<string, unknown> {
  return {
    type: 'PLANNING_COMMIT',
    profileId: input.scope.profileId,
    operationId: input.scope.operationId,
    scenarioId: input.scenarioId,
    baseRevision: input.baseRevision,
    changes: input.changes,
    approvedPreviewToken: input.approvedPreviewToken,
  };
}

function byId(left: { id: string }, right: { id: string }): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

export class LocalPlanningRepository implements PlanningRepository {
  private readonly fault: Fault;
  private readonly now: () => string;

  constructor(options: PlanningRepositoryOptions = {}) {
    this.fault = options.fault ?? null;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async loadScenario(
    profileId: string,
    scenarioId: string,
  ): Promise<PlanningScenarioSnapshot | null> {
    const database = await openV2Database(profileId);
    const transaction = database.transaction(
      [STORES.planningScenarios, STORES.planningBlocks],
      'readonly',
    );
    const scenario = (await requestResult(
      transaction.objectStore(STORES.planningScenarios).get([profileId, scenarioId]),
    )) as PlanningScenario | undefined;
    if (!scenario) return null;
    const blocks = (await requestResult(
      transaction
        .objectStore(STORES.planningBlocks)
        .index('by_scenario')
        .getAll([profileId, scenarioId]),
    )) as PlanBlock[];
    return { scenario, blocks: blocks.sort(byId) };
  }

  async listScenarios(profileId: string, editalId?: string): Promise<PlanningScenario[]> {
    const database = await openV2Database(profileId);
    const transaction = database.transaction(STORES.planningScenarios, 'readonly');
    const store = transaction.objectStore(STORES.planningScenarios);
    const records = (
      editalId
        ? await requestResult(store.index('by_profile_edital').getAll([profileId, editalId]))
        : await requestResult(store.index('by_profile').getAll(profileId))
    ) as PlanningScenario[];
    return records.sort((left, right) => (left.createdAt ?? '').localeCompare(right.createdAt ?? '') || byId(left, right));
  }

  async loadDraft(profileId: string, scenarioId: string): Promise<PlanningDraft | null> {
    const database = await openV2Database(profileId);
    const transaction = database.transaction(STORES.planningDrafts, 'readonly');
    const record = await requestResult(
      transaction.objectStore(STORES.planningDrafts).get([profileId, scenarioId]),
    );
    return (record as PlanningDraft | undefined) ?? null;
  }

  async saveDraft(draft: PlanningDraft): Promise<PlanningOutcome<PlanningDraft>> {
    if (
      !draft ||
      typeof draft.profileId !== 'string' ||
      !draft.profileId.trim() ||
      typeof draft.scenarioId !== 'string' ||
      !draft.scenarioId.trim() ||
      !Number.isInteger(draft.baseRevision) ||
      draft.baseRevision < 1
    ) {
      return { kind: 'INVALID', code: 'INVALID_DRAFT' };
    }
    try {
      const database = await openV2Database(draft.profileId);
      // The draft is staging only: no scenario, block or outbox write happens
      // here, so a failure can never damage the committed plan.
      const transaction = database.transaction(STORES.planningDrafts, 'readwrite');
      const persisted: PlanningDraft = { ...draft, lastSavedAt: this.now() };
      transaction.objectStore(STORES.planningDrafts).put(persisted);
      await transactionDone(transaction);
      notifyPlanningChange(draft.profileId, draft.scenarioId);
      return { kind: 'LOCAL_COMMITTED', value: persisted };
    } catch (error) {
      return { kind: 'FAILED', reason: toLocalPersistenceError(error).kind };
    }
  }

  async activateScenario(
    input: PlanningActivationInput,
  ): Promise<PlanningOutcome<PlanningScenarioSnapshot>> {
    if (!input || !input.checkpointId) {
      return { kind: 'BLOCKED', reason: 'CHECKPOINT_REQUIRED' };
    }
    if (
      typeof input.profileId !== 'string' ||
      !input.profileId.trim() ||
      typeof input.operationId !== 'string' ||
      !input.operationId.trim() ||
      typeof input.scenarioId !== 'string' ||
      !input.scenarioId.trim()
    ) {
      return { kind: 'INVALID', code: 'INVALID_COMMAND' };
    }

    const command = {
      type: 'PLANNING_ACTIVATE',
      profileId: input.profileId,
      operationId: input.operationId,
      editalId: input.editalId,
      scenarioId: input.scenarioId,
      checkpointId: input.checkpointId,
    };
    const commandJson = stableStringify(command);
    const database = await openV2Database(input.profileId);
    const transaction = database.transaction(
      [
        STORES.planningScenarios,
        STORES.planningBlocks,
        STORES.operations,
        STORES.outbox,
        STORES.planningCheckpoints,
      ],
      'readwrite',
    );

    try {
      const operations = transaction.objectStore(STORES.operations);
      const replay = (await requestResult(operations.get(input.operationId))) as
        | PlanningOperationRecord
        | undefined;
      if (replay) {
        if (
          replay.profileId !== input.profileId ||
          stableStringify(replay.command) !== commandJson
        ) {
          transaction.abort();
          return { kind: 'INVALID', code: 'OPERATION_ID_REUSED' };
        }
        await transactionDone(transaction);
        return replay.outcome;
      }

      const scenarioStore = transaction.objectStore(STORES.planningScenarios);
      const blockStore = transaction.objectStore(STORES.planningBlocks);
      const outbox = transaction.objectStore(STORES.outbox);
      const next = (await requestResult(
        scenarioStore.get([input.profileId, input.scenarioId]),
      )) as PlanningScenario | undefined;
      if (!next) {
        transaction.abort();
        return { kind: 'INVALID', code: 'SCENARIO_NOT_FOUND' };
      }
      if (next.editalId !== input.editalId) {
        transaction.abort();
        return { kind: 'INVALID', code: 'EDITAL_MISMATCH' };
      }
      if (
        input.baseRevision !== null &&
        input.baseRevision !== undefined &&
        next.localRevision !== input.baseRevision
      ) {
        transaction.abort();
        return { kind: 'CONFLICT', current: next };
      }

      const siblings = (await requestResult(
        scenarioStore.index('by_profile_edital').getAll([input.profileId, input.editalId]),
      )) as PlanningScenario[];

      if (this.fault === 'abort') throw new DOMException('forced abort', 'AbortError');
      if (this.fault === 'quota') throw new DOMException('forced quota', 'QuotaExceededError');

      const deactivated: PlanningScenario[] = [];
      for (const sibling of siblings) {
        if (sibling.id === next.id || sibling.status !== 'ACTIVE') continue;
        const updated: PlanningScenario = {
          ...sibling,
          status: 'INACTIVE',
          localRevision: sibling.localRevision + 1,
          updatedAt: this.now(),
        };
        scenarioStore.put(updated);
        deactivated.push(updated);
        outbox.put({
          operationId: `${input.operationId}~deactivate~${updated.id}`,
          profileId: input.profileId,
          entityType: 'planning-scenario',
          entityId: updated.id,
          kind: 'upsert',
          baseRevision: sibling.localRevision,
          payload: updated,
          schemaVersion: PLANNING_ENTITY_SCHEMA_VERSION,
          status: 'PENDING',
          deliveryMode: 'BLOCKED',
        });
      }

      const activated: PlanningScenario = {
        ...next,
        status: 'ACTIVE',
        localRevision: next.localRevision + 1,
        updatedAt: this.now(),
      };
      scenarioStore.put(activated);
      outbox.put({
        operationId: `${input.operationId}~activate~${activated.id}`,
        profileId: input.profileId,
        entityType: 'planning-scenario',
        entityId: activated.id,
        kind: 'upsert',
        baseRevision: next.localRevision,
        payload: activated,
        schemaVersion: PLANNING_ENTITY_SCHEMA_VERSION,
        status: 'PENDING',
        deliveryMode: 'BLOCKED',
      });

      const registeredBlocks = (await requestResult(
        blockStore.index('by_scenario').getAll([input.profileId, input.scenarioId]),
      )) as PlanBlock[];
      transaction.objectStore(STORES.planningCheckpoints).put({
        checkpointId: input.checkpointId,
        profileId: input.profileId,
        scenarioId: input.scenarioId,
        kind: 'AUTO',
        manifest: {
          activationOf: input.scenarioId,
          deactivated: deactivated.map((item) => item.id),
          blockIds: registeredBlocks.map((item) => item.id),
          blockCount: registeredBlocks.length,
        },
        operationId: input.operationId,
        createdAt: this.now(),
      });

      const snapshot: PlanningScenarioSnapshot = {
        scenario: activated,
        blocks: registeredBlocks.sort(byId),
      };
      const outcome: PlanningOutcome<PlanningScenarioSnapshot> = {
        kind: 'LOCAL_COMMITTED',
        value: snapshot,
      };
      operations.put({
        operationId: input.operationId,
        profileId: input.profileId,
        entityType: 'planning-commit',
        entityId: input.scenarioId,
        command,
        outcome,
        committedAt: this.now(),
      } satisfies PlanningOperationRecord);

      await transactionDone(transaction);
      notifyPlanningChange(input.profileId, input.scenarioId);
      return outcome;
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // already aborted
      }
      return { kind: 'FAILED', reason: toLocalPersistenceError(error).kind };
    }
  }

  async commit(input: PlanningCommit): Promise<PlanningOutcome<PlanningScenarioSnapshot>> {
    const scope = input?.scope;
    if (
      !scope ||
      typeof scope.profileId !== 'string' ||
      !scope.profileId.trim() ||
      typeof scope.operationId !== 'string' ||
      !scope.operationId.trim() ||
      typeof input.scenarioId !== 'string' ||
      !input.scenarioId.trim()
    ) {
      return { kind: 'INVALID', code: 'INVALID_COMMAND' };
    }

    const command = normalizeCommit(input);
    const commandJson = stableStringify(command);
    const database = await openV2Database(scope.profileId);
    const transaction = database.transaction(
      [
        STORES.planningScenarios,
        STORES.planningBlocks,
        STORES.operations,
        STORES.outbox,
        STORES.planningCheckpoints,
      ],
      'readwrite',
    );

    try {
      const operations = transaction.objectStore(STORES.operations);
      const replay = (await requestResult(operations.get(scope.operationId))) as
        | PlanningOperationRecord
        | undefined;
      if (replay) {
        if (
          replay.profileId !== scope.profileId ||
          stableStringify(replay.command) !== commandJson
        ) {
          transaction.abort();
          return { kind: 'INVALID', code: 'OPERATION_ID_REUSED' };
        }
        await transactionDone(transaction);
        return replay.outcome;
      }

      const scenarioStore = transaction.objectStore(STORES.planningScenarios);
      const blockStore = transaction.objectStore(STORES.planningBlocks);
      const current = (await requestResult(
        scenarioStore.get([scope.profileId, input.scenarioId]),
      )) as PlanningScenario | undefined;

      if (!current && !input.changes.scenario) {
        transaction.abort();
        return { kind: 'INVALID', code: 'SCENARIO_NOT_FOUND' };
      }
      // CAS is checked inside the transaction, never from a stale preview.
      if (current) {
        if (input.baseRevision === null) {
          transaction.abort();
          return { kind: 'CONFLICT', current };
        }
        if (
          input.baseRevision !== undefined &&
          current.localRevision !== input.baseRevision
        ) {
          transaction.abort();
          return { kind: 'CONFLICT', current };
        }
      } else if (input.baseRevision !== null && input.baseRevision !== undefined) {
        transaction.abort();
        return { kind: 'CONFLICT', current: null };
      }

      let nextScenario: PlanningScenario;
      try {
        const base = input.changes.scenario as PlanningScenario;
        nextScenario = validateScenario({
          ...(current ? (input.changes.scenario ?? current) : base),
          id: input.scenarioId,
          profileId: scope.profileId,
          editalId: (current ?? base).editalId,
          localRevision: (current?.localRevision ?? 0) + 1,
          createdAt: current?.createdAt ?? this.now(),
          updatedAt: this.now(),
        });
      } catch (error) {
        transaction.abort();
        if (error instanceof PlanningValidationError) {
          return { kind: 'INVALID', code: error.code };
        }
        return { kind: 'FAILED', reason: 'VALIDATION' };
      }

      if (nextScenario.status === 'ACTIVE') {
        const siblings = (await requestResult(
          scenarioStore.index('by_profile_edital').getAll([
            scope.profileId,
            nextScenario.editalId,
          ]),
        )) as PlanningScenario[];
        const otherActive = siblings.find(
          (item) => item.id !== nextScenario.id && item.status === 'ACTIVE',
        );
        if (otherActive) {
          transaction.abort();
          return { kind: 'BLOCKED', reason: `ANOTHER_SCENARIO_ACTIVE:${otherActive.id}` };
        }
      }

      if (this.fault === 'abort') throw new DOMException('forced abort', 'AbortError');
      if (this.fault === 'quota') throw new DOMException('forced quota', 'QuotaExceededError');

      scenarioStore.put(nextScenario);
      const outbox = transaction.objectStore(STORES.outbox);
      outbox.put({
        operationId: `${scope.operationId}~scenario~${nextScenario.id}`,
        profileId: scope.profileId,
        entityType: 'planning-scenario',
        entityId: nextScenario.id,
        kind: 'upsert',
        baseRevision: current?.localRevision ?? null,
        payload: nextScenario,
        schemaVersion: PLANNING_ENTITY_SCHEMA_VERSION,
        status: 'PENDING',
        deliveryMode: 'BLOCKED',
      });

      for (const block of input.changes.upsertBlocks ?? []) {
        let validated: PlanBlock;
        try {
          validated = validatePlanBlock(block, {
            profileId: scope.profileId,
            editalId: nextScenario.editalId,
            scenarioId: input.scenarioId,
          });
        } catch (error) {
          transaction.abort();
          if (error instanceof PlanningValidationError) {
            return { kind: 'INVALID', code: error.code };
          }
          return { kind: 'FAILED', reason: 'VALIDATION' };
        }
        const existing = (await requestResult(
          blockStore.get([scope.profileId, validated.id]),
        )) as PlanBlock | undefined;
        const persisted: PlanBlock = {
          ...validated,
          localRevision: (existing?.localRevision ?? 0) + 1,
        };
        blockStore.put(persisted);
        outbox.put({
          operationId: `${scope.operationId}~block~${persisted.id}`,
          profileId: scope.profileId,
          entityType: 'plan-block',
          entityId: persisted.id,
          kind: 'upsert',
          baseRevision: existing?.localRevision ?? null,
          payload: persisted,
          schemaVersion: PLANNING_ENTITY_SCHEMA_VERSION,
          status: 'PENDING',
          deliveryMode: 'BLOCKED',
        });
      }

      for (const blockId of input.changes.deleteBlockIds ?? []) {
        const existing = (await requestResult(
          blockStore.get([scope.profileId, blockId]),
        )) as PlanBlock | undefined;
        if (!existing) continue;
        if (existing.scenarioId !== input.scenarioId) {
          transaction.abort();
          return { kind: 'INVALID', code: 'SCENARIO_MISMATCH' };
        }
        blockStore.delete([scope.profileId, blockId]);
        outbox.put({
          operationId: `${scope.operationId}~delete~${blockId}`,
          profileId: scope.profileId,
          entityType: 'plan-block',
          entityId: blockId,
          kind: 'delete',
          baseRevision: existing.localRevision,
          payload: existing,
          schemaVersion: PLANNING_ENTITY_SCHEMA_VERSION,
          status: 'PENDING',
          deliveryMode: 'BLOCKED',
        });
      }

      if (input.checkpoint) {
        transaction.objectStore(STORES.planningCheckpoints).put({
          checkpointId: input.checkpoint.checkpointId,
          profileId: scope.profileId,
          scenarioId: input.scenarioId,
          kind: input.checkpoint.kind,
          manifest: input.checkpoint.manifest ?? {},
          operationId: scope.operationId,
          createdAt: this.now(),
        });
      }

      const persistedBlocks = (await requestResult(
        blockStore.index('by_scenario').getAll([scope.profileId, input.scenarioId]),
      )) as PlanBlock[];
      const snapshot: PlanningScenarioSnapshot = {
        scenario: nextScenario,
        blocks: persistedBlocks.sort(byId),
      };
      const outcome: PlanningOutcome<PlanningScenarioSnapshot> = {
        kind: 'LOCAL_COMMITTED',
        value: snapshot,
      };

      operations.put({
        operationId: scope.operationId,
        profileId: scope.profileId,
        entityType: 'planning-commit',
        entityId: input.scenarioId,
        command,
        outcome,
        committedAt: this.now(),
      } satisfies PlanningOperationRecord);

      await transactionDone(transaction);
      notifyPlanningChange(scope.profileId, input.scenarioId);
      return outcome;
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // already aborted
      }
      return { kind: 'FAILED', reason: toLocalPersistenceError(error).kind };
    }
  }
}
