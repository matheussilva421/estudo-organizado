// Legacy Reta Final (pre-v2) adoption. Pure: no DOM, store, network or clock.
//
// A Firestore snapshot written before the v2 descriptor existed carries a
// `planejamento` without `planId`, `revision` or `schemaVersionRetaFinal`. When
// the local device already migrated the same planning to v2, the remote shape
// must not be read as "no plan". It can be adopted as the v2 base only after a
// conservative proof that both sides still describe the same human intent.
import { migrateRetaFinalV2, validateRetaFinalV2 } from '../logic/reta-final-schema.js?v=8.37';

// v2 identifiers and bookkeeping never exist in a legacy snapshot.
const MIGRATION_FIELDS = new Set([
  'planId',
  'lineageId',
  'generation',
  'revision',
  'schemaVersionRetaFinal',
  'updatedAt',
  'operations',
  'pendingOperations',
  'operationIds',
  'minRetainedRevision',
]);
// Descendant metadata copied into the plan by v2 sync helpers.
const MIGRATION_RETA_FINAL_FIELDS = new Set(['removedBlockIds', 'minRetainedRevision']);
// Fields rewritten by the scheduling projection or by event reconciliation.
const DERIVED_BLOCK_FIELDS = new Set([
  'data',
  'dataEfetiva',
  'categoriaTemporal',
  'naoAlocado',
  'concluido',
  'atrasoDias',
  'status',
  'rolagens',
  'motivoNaoAlocado',
  'rolado',
]);
const DIFFERENCE_LIMIT = 40;

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stable(value) {
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (record(value)) {
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map((key) => JSON.stringify(key) + ':' + stable(value[key]))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(value);
}

function unionKeys(left, right) {
  return [
    ...new Set([
      ...Object.keys(record(left) ? left : {}),
      ...Object.keys(record(right) ? right : {}),
    ]),
  ].sort();
}

/** A Reta Final planning regardless of its schema generation. */
export function isRetaFinalPlanShape(plan) {
  return (
    record(plan) &&
    plan.tipo === 'reta_final' &&
    record(plan.retaFinal) &&
    Array.isArray(plan.retaFinal.blocos)
  );
}

/** True only for the exact pre-v2 shape the migration can rebuild losslessly. */
export function isLegacyRetaFinalPlan(plan) {
  if (!isRetaFinalPlanShape(plan)) return false;
  if (plan.schemaVersionRetaFinal === 2) return false;
  if (plan.planId !== undefined && plan.planId !== null) return false;
  if (plan.revision !== undefined && plan.revision !== null) return false;
  return true;
}

function intentOf(plan) {
  const copy = clone(plan);
  for (const key of MIGRATION_FIELDS) delete copy[key];
  if (record(copy.retaFinal)) {
    for (const key of MIGRATION_RETA_FINAL_FIELDS) delete copy.retaFinal[key];
    copy.retaFinal.blocos = copy.retaFinal.blocos.map((block) => {
      if (!record(block)) return block;
      const clean = { ...block };
      for (const field of DERIVED_BLOCK_FIELDS) delete clean[field];
      return clean;
    });
  }
  return copy;
}

function planDifferences(local, remote) {
  const differences = [];
  const push = (path) => {
    if (differences.length < DIFFERENCE_LIMIT) differences.push(path);
  };
  for (const key of unionKeys(local, remote)) {
    if (key === 'retaFinal') continue;
    if (stable(local[key]) !== stable(remote[key])) push(key);
  }
  const localPlan = record(local.retaFinal) ? local.retaFinal : {};
  const remotePlan = record(remote.retaFinal) ? remote.retaFinal : {};
  for (const key of unionKeys(localPlan, remotePlan)) {
    if (key === 'blocos') continue;
    if (stable(localPlan[key]) !== stable(remotePlan[key])) {
      push(`retaFinal.${key}`);
    }
  }
  const byId = (value) => {
    const map = new Map();
    const list = Array.isArray(value.blocos) ? value.blocos : [];
    for (const block of list) {
      if (record(block) && typeof block.id === 'string') {
        map.set(block.id, block);
      }
    }
    return map;
  };
  const localBlocks = byId(localPlan);
  const remoteBlocks = byId(remotePlan);
  for (const id of [...new Set([...localBlocks.keys(), ...remoteBlocks.keys()])].sort()) {
    const left = localBlocks.get(id);
    const right = remoteBlocks.get(id);
    if (!left || !right) {
      push(`retaFinal.blocos.${id}`);
      continue;
    }
    for (const field of unionKeys(left, right)) {
      if (field === 'id') continue;
      if (stable(left[field]) !== stable(right[field])) {
        push(`retaFinal.blocos.${id}.${field}`);
      }
    }
  }
  return differences;
}

/**
 * Decide whether a legacy remote planning is the direct ancestor of the local
 * v2 planning. Only equivalent plans produce a v2 base; anything else is a
 * material divergence that requires human reconciliation.
 */
export function buildLegacyRetaFinalAdoption({ legacyPlan, localPlan } = {}) {
  if (!isRetaFinalPlanShape(legacyPlan)) {
    return {
      status: 'not-legacy',
      reasons: ['O planejamento remoto nao e uma Reta Final.'],
    };
  }
  if (legacyPlan.schemaVersionRetaFinal === 2) {
    return {
      status: 'not-legacy',
      reasons: ['O planejamento remoto ja esta no schema v2.'],
    };
  }
  if (!isLegacyRetaFinalPlan(legacyPlan)) {
    return {
      status: 'ambiguous',
      reasons: ['O planejamento remoto possui metadados v2 parciais.'],
    };
  }
  const localValidation = validateRetaFinalV2(localPlan);
  if (localPlan?.schemaVersionRetaFinal !== 2 || !localValidation.valid) {
    return { status: 'invalid-local', reasons: localValidation.errors };
  }
  const migration = migrateRetaFinalV2(clone(legacyPlan), {
    makePlanId: () => localPlan.planId,
  });
  if (!migration.changed || !record(migration.plan)) {
    return {
      status: 'invalid-legacy',
      reasons: migration.diagnostics?.length
        ? migration.diagnostics
        : ['A migracao do plano legado nao produziu um plano v2.'],
    };
  }
  const candidate = { ...migration.plan, revision: 0 };
  if (candidate.planId !== localPlan.planId) {
    return {
      status: 'invalid-legacy',
      reasons: ['A migracao do plano legado trocou a identidade do plano.'],
    };
  }
  const candidateValidation = validateRetaFinalV2(candidate);
  if (!candidateValidation.valid) {
    return { status: 'invalid-legacy', reasons: candidateValidation.errors };
  }
  const differences = planDifferences(intentOf(localPlan), intentOf(candidate));
  if (differences.length) return { status: 'mismatch', differences };
  return { status: 'equivalent', plan: candidate, differences: [] };
}

/**
 * Write-side barrier: an adoption may only replace a legacy Reta Final planning
 * that is provably the same intent. Called after the structural CAS checks.
 */
export function assessLegacyRetaFinalWrite({ plan, remoteEnvelope } = {}) {
  if (!record(remoteEnvelope)) return { allowed: true, reason: 'no-remote' };
  if (Object.hasOwn(remoteEnvelope, 'retaFinalSync')) {
    return { allowed: true, reason: 'remote-v2' };
  }
  const remotePlan = remoteEnvelope.payload?.planejamento;
  if (!record(remotePlan) || !isRetaFinalPlanShape(remotePlan)) {
    return { allowed: true, reason: 'no-reta-plan' };
  }
  if (!record(plan) || plan.tipo !== 'reta_final') {
    return { allowed: false, reason: 'missing-local-plan', differences: [] };
  }
  if (remotePlan.schemaVersionRetaFinal === 2) {
    // A v2 planning without a descriptor cannot be adopted: revision and
    // snapshot lineage are unknown, so a baseRevision 0 write could rewind it.
    return {
      allowed: false,
      reason: 'ambiguous-v2-remote',
      differences: ['retaFinalSync'],
    };
  }
  const adoption = buildLegacyRetaFinalAdoption({
    legacyPlan: remotePlan,
    localPlan: plan,
  });
  if (adoption.status === 'equivalent') {
    return { allowed: true, reason: 'legacy-equivalent' };
  }
  return {
    allowed: false,
    reason: adoption.status === 'mismatch' ? 'mismatch' : 'invalid-legacy',
    differences: adoption.differences ?? adoption.reasons ?? [],
  };
}
