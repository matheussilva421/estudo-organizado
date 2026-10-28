export const FIRESTORE_DOCUMENT_LIMIT_BYTES = 1_048_576;
export const MAX_SAFE_DOCUMENT_BYTES = 900_000;

const encoder = new TextEncoder();

export function estimateRemoteEnvelopeBytes(record: unknown): number {
  try {
    const json = JSON.stringify(record) ?? '';
    return encoder.encode(json).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export type DocumentValidation =
  | { ok: true; bytes: number }
  | { ok: false; bytes: number; reason: 'OVERSIZE' | 'INVALID' };

export function validateRemoteDocument(record: unknown): DocumentValidation {
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    return { ok: false, bytes: 0, reason: 'INVALID' };
  }
  const bytes = estimateRemoteEnvelopeBytes(record);
  if (!Number.isFinite(bytes)) return { ok: false, bytes: 0, reason: 'INVALID' };
  if (bytes > MAX_SAFE_DOCUMENT_BYTES) return { ok: false, bytes, reason: 'OVERSIZE' };
  return { ok: true, bytes };
}

export function estimateIncrementalWriteBytes(entity: unknown): number {
  return estimateRemoteEnvelopeBytes(entity);
}

export type WorkloadEstimate = {
  devices: number;
  entities: number;
  changesPerDay: number;
  writesPerDay: number;
  readsPerDay: number;
  indexEntries: number;
  maxDocumentBytes: number;
  assumptions: string[];
};

export function estimateWorkload(
  entities: number,
  devices: 1 | 2 | 3,
  changesPerDay: number,
): WorkloadEstimate {
  const safeEntities = Math.max(0, Math.floor(entities));
  const safeChanges = Math.max(0, Math.floor(changesPerDay));
  const writesPerDay = devices * safeChanges;

  return {
    devices,
    entities: safeEntities,
    changesPerDay: safeChanges,
    writesPerDay,
    readsPerDay: writesPerDay * 2,
    indexEntries: safeEntities,
    maxDocumentBytes: MAX_SAFE_DOCUMENT_BYTES,
    assumptions: [
      `${devices} dispositivos ativos na mesma conta Google`,
      '1 escrita por alteração por dispositivo',
      '2 leituras por alteração (precondição + confirmação)',
      'sem listeners contínuos nem leituras de índice adicionais na F1',
      'estimativa sintética; não é custo faturado e não habilita billing',
    ],
  };
}

export const SPARK_DAILY_WRITE_PREMISE = 20_000;

export type F2BudgetScenario = {
  devices: 1 | 2 | 3;
  entities: number;
  writesPerEntity: number;
  writesPerDay: number;
  sparkPremise: number;
  exceedsSparkPremise: boolean;
  recommendation: string;
  isBillingMeasurement: false;
};

/**
 * Synthetic Firestore budget for F2. It is an estimate built from the accepted
 * document ceiling, never a quota measurement or a billing figure.
 */
export function estimateF2Budget(
  entities: number,
  devices: 1 | 2 | 3,
  writesPerEntity: number,
): F2BudgetScenario {
  const safeEntities = Math.max(0, Math.floor(entities));
  const safeWrites = Math.max(1, Math.floor(writesPerEntity));
  const writesPerDay = safeEntities * devices * safeWrites;
  const exceeds = writesPerDay > SPARK_DAILY_WRITE_PREMISE;
  return {
    devices,
    entities: safeEntities,
    writesPerEntity: safeWrites,
    writesPerDay,
    sparkPremise: SPARK_DAILY_WRITE_PREMISE,
    exceedsSparkPremise: exceeds,
    recommendation: exceeds
      ? 'seed único por importação e leituras incrementais; não repetir a importação por dispositivo'
      : 'carga dentro da premissa analisada',
    isBillingMeasurement: false,
  };
}
