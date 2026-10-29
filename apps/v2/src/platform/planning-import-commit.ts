import type { PlanBlock, PlanningOutcome, PlanningScenario } from '../domain/planning';
import { validatePlanBlock, validateScenario } from '../domain/planning';
import type { PlanningImportPreview } from '../application/planning-portability';
import { hashText, toScenarioFromParsed } from '../application/planning-portability';
import { PLANNING_ENTITY_SCHEMA_VERSION } from '../application/planning-service';
import {
  openV2Database,
  requestResult,
  STORES,
  toLocalPersistenceError,
  transactionDone,
} from './indexeddb';
import { notifyPlanningChange } from './local-events';
import type { Edital, EditalDiscipline } from '../domain/edital';

type Fault = 'abort' | 'quota' | null;

export type PlanningImportResult = {
  importId: string;
  scenarioIds: string[];
  applied: number;
  skipped: number;
};

export type PlanningImportReceipt = {
  importId: string;
  profileId: string;
  format: string;
  fingerprint: string;
  targetSignature: string;
  scenarioIds: string[];
  applied: number;
  skipped: number;
  createdAt: string;
};

/**
 * Applies a confirmed import preview in one IndexedDB transaction: scenarios,
 * blocks, its operation record, the outbox intents and the receipt either all
 * exist or none of them do.
 */
export class LocalPlanningImportCommitter {
  private readonly fault: Fault;
  private readonly now: () => string;

  constructor(options: { fault?: Fault; now?: () => string } = {}) {
    this.fault = options.fault ?? null;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async apply(
    profileId: string,
    preview: PlanningImportPreview,
    approval: { confirmed: boolean; targetSignature: string; targetEditalId?: string },
  ): Promise<PlanningOutcome<PlanningImportResult>> {
    if (!approval?.confirmed) {
      return { kind: 'BLOCKED', reason: 'CONFIRMATION_REQUIRED' };
    }
    if (approval.targetSignature !== preview.targetSignature) {
      return { kind: 'INVALID', code: 'TARGET_SIGNATURE_MISMATCH' };
    }
    const blocking = preview.entries.filter(
      (entry) => entry.kind === 'AMBIGUOUS' || entry.kind === 'DIVERGENT',
    );
    if (blocking.length > 0) {
      return { kind: 'BLOCKED', reason: 'RECONCILIATION_REQUIRED' };
    }
    const targetEditalId = approval.targetEditalId?.trim();
    if (!targetEditalId) {
      return { kind: 'INVALID', code: 'TARGET_EDITAL_REQUIRED' };
    }

    // Two files may carry identical blocks with different names; the name hash
    // keeps both imports distinct instead of replaying the first receipt.
    const importId = `import~${preview.fingerprint}~${hashText(
      preview.entries.map((entry) => entry.name).join('|'),
    )}`;
    const database = await openV2Database(profileId);
    const transaction = database.transaction(
      [
        STORES.planningScenarios,
        STORES.planningBlocks,
        STORES.operations,
        STORES.outbox,
        STORES.planningImports,
        STORES.editais,
        STORES.editalDisciplines,
      ],
      'readwrite',
    );

    try {
      const receipts = transaction.objectStore(STORES.planningImports);
      const replay = (await requestResult(receipts.get([profileId, importId]))) as
        | PlanningImportReceipt
        | undefined;
      if (replay) {
        await transactionDone(transaction);
        return {
          kind: 'LOCAL_COMMITTED',
          value: {
            importId,
            scenarioIds: replay.scenarioIds,
            applied: replay.applied,
            skipped: replay.skipped,
          },
        };
      }

      if (this.fault === 'abort') throw new DOMException('forced abort', 'AbortError');
      if (this.fault === 'quota') throw new DOMException('forced quota', 'QuotaExceededError');

      const edital = (await requestResult(
        transaction.objectStore(STORES.editais).get([profileId, targetEditalId]),
      )) as Edital | undefined;
      if (!edital || edital.status !== 'ACTIVE') {
        transaction.abort();
        return { kind: 'INVALID', code: 'TARGET_EDITAL_NOT_FOUND' };
      }
      const linkStore = transaction.objectStore(STORES.editalDisciplines);

      const scenarios = transaction.objectStore(STORES.planningScenarios);
      const blocks = transaction.objectStore(STORES.planningBlocks);
      const outbox = transaction.objectStore(STORES.outbox);
      const scenarioIds: string[] = [];
      let applied = 0;
      let skipped = 0;

      for (const entry of preview.entries) {
        if (entry.kind !== 'NEW') {
          skipped += 1;
          continue;
        }
        const parsed = preview.scenarios[entry.index];
        if (!parsed) continue;
        const operationId = `${importId}~scenario~${entry.index}`;
        const built = toScenarioFromParsed(parsed, {
          profileId,
          scenarioId: `${importId}~${entry.index}`,
          editalId: targetEditalId,
          operationId,
        });
        const scenario: PlanningScenario = validateScenario({
          ...built.scenario,
          createdAt: this.now(),
          updatedAt: this.now(),
        });
        const existing = await requestResult(scenarios.get([profileId, scenario.id]));
        if (existing) {
          skipped += 1;
          continue;
        }
        scenarios.put(scenario);
        for (const block of built.blocks) {
          const link = block.editalDisciplineId
            ? ((await requestResult(
                linkStore.get([profileId, block.editalDisciplineId]),
              )) as EditalDiscipline | undefined)
            : undefined;
          const mapped = link !== undefined && link.editalId === targetEditalId;
          const persisted: PlanBlock = validatePlanBlock({
            ...block,
            scenarioId: scenario.id,
            editalDisciplineId: mapped ? block.editalDisciplineId : 'unmapped',
            allocation: mapped ? block.allocation : 'UNALLOCATED',
            reason: mapped ? block.reason : 'UNMAPPED_CONTENT',
          });
          blocks.put(persisted);
          outbox.put({
            operationId: `${operationId}~block~${persisted.id}`,
            profileId,
            entityType: 'plan-block',
            entityId: persisted.id,
            kind: 'upsert',
            baseRevision: null,
            payload: persisted,
            schemaVersion: PLANNING_ENTITY_SCHEMA_VERSION,
            status: 'PENDING',
            deliveryMode: 'BLOCKED',
          });
        }
        outbox.put({
          operationId: `${operationId}~scenario`,
          profileId,
          entityType: 'planning-scenario',
          entityId: scenario.id,
          kind: 'upsert',
          baseRevision: null,
          payload: scenario,
          schemaVersion: PLANNING_ENTITY_SCHEMA_VERSION,
          status: 'PENDING',
          deliveryMode: 'BLOCKED',
        });
        scenarioIds.push(scenario.id);
        applied += 1;
      }

      const receipt: PlanningImportReceipt = {
        importId,
        profileId,
        format: preview.format,
        fingerprint: preview.fingerprint,
        targetSignature: preview.targetSignature,
        scenarioIds,
        applied,
        skipped,
        createdAt: this.now(),
      };
      receipts.put(receipt);
      transaction.objectStore(STORES.operations).put({
        operationId: importId,
        profileId,
        entityType: 'planning-import',
        entityId: importId,
        command: {
          type: 'PLANNING_IMPORT',
          profileId,
          fingerprint: preview.fingerprint,
          targetSignature: preview.targetSignature,
        },
        outcome: { kind: 'LOCAL_COMMITTED', value: { importId, scenarioIds, applied, skipped } },
        committedAt: this.now(),
      });

      await transactionDone(transaction);
      for (const scenarioId of scenarioIds) notifyPlanningChange(profileId, scenarioId);
      return {
        kind: 'LOCAL_COMMITTED',
        value: { importId, scenarioIds, applied, skipped },
      };
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
