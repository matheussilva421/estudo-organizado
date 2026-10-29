import type { PlanBlock } from './planning';

/**
 * F2 link protection and the F4 reference contract.
 *
 * F4 sessions do not exist in F3: only the shapes and the global accounting
 * rule are defined here, so a future session can never be counted twice.
 */

export type ExecutionLinkFixture = {
  sessionId: string;
  plannedBlockId?: string | null;
  editalId: string;
  editalDisciplineId: string;
  assuntoId?: string;
  aulaId?: string;
  durationMinutes: number;
};

export type ExecutionSummary = {
  uniqueMinutes: number;
  sessionCount: number;
  coverageByEdital: Record<string, string[]>;
  inconsistentSessionIds: string[];
};

/**
 * A session is one real fact: it is counted exactly once, even when it serves
 * several editais, and coverage never completes another plan automatically.
 */
export function summarizeExecutionLinks(
  links: ExecutionLinkFixture[],
): ExecutionSummary {
  const bySession = new Map<string, ExecutionLinkFixture>();
  const inconsistent = new Set<string>();
  for (const link of links) {
    if (!link.sessionId) continue;
    const existing = bySession.get(link.sessionId);
    if (existing && existing.durationMinutes !== link.durationMinutes) {
      inconsistent.add(link.sessionId);
      continue;
    }
    if (!existing) bySession.set(link.sessionId, link);
  }

  const coverageByEdital: Record<string, string[]> = {};
  for (const link of links) {
    const covered = coverageByEdital[link.editalId] ?? [];
    const reference = link.assuntoId ?? link.aulaId ?? link.plannedBlockId ?? null;
    if (reference && !covered.includes(reference)) covered.push(reference);
    coverageByEdital[link.editalId] = covered;
  }

  return {
    uniqueMinutes: [...bySession.values()].reduce(
      (sum, link) => sum + Math.max(0, link.durationMinutes),
      0,
    ),
    sessionCount: bySession.size,
    coverageByEdital,
    inconsistentSessionIds: [...inconsistent],
  };
}

export type ContentLinkStatus = 'VALID' | 'ARCHIVED' | 'MISSING' | 'INVALID_SCOPE';

export type ContentLinkCheck = {
  blockId: string;
  status: ContentLinkStatus;
  detail: string;
};

export type ContentLinkContext = {
  editais: { id: string; status: string }[];
  links: { id: string; editalId: string; status: string }[];
  assuntos: { id: string; editalDisciplineId: string }[];
  aulas: { id: string; editalDisciplineId: string }[];
  /** Soft-deleted F2 entities; deletion never rewrites the plan. */
  archivedIds?: string[];
};

/**
 * References are resolved by opaque ids only. A homonymous rename keeps the
 * reference valid; an archived, missing or cross-scope link is reported so the
 * UI can ask for a supervised reconciliation.
 */
export function reconcileContentLinks(
  blocks: PlanBlock[],
  context: ContentLinkContext,
): ContentLinkCheck[] {
  const editais = new Map(context.editais.map((item) => [item.id, item]));
  const links = new Map(context.links.map((item) => [item.id, item]));
  const assuntos = new Map(context.assuntos.map((item) => [item.id, item]));
  const aulas = new Map(context.aulas.map((item) => [item.id, item]));
  const archived = new Set(context.archivedIds ?? []);

  return blocks.map((block) => {
    const link = links.get(block.editalDisciplineId);
    if (!link) {
      return { blockId: block.id, status: 'MISSING', detail: 'edital-discipline' };
    }
    if (link.status !== 'ACTIVE' || archived.has(link.id)) {
      return { blockId: block.id, status: 'ARCHIVED', detail: 'edital-discipline' };
    }
    const edital = editais.get(link.editalId);
    if (!edital || edital.status !== 'ACTIVE' || archived.has(edital.id)) {
      return { blockId: block.id, status: 'ARCHIVED', detail: 'edital' };
    }
    if (block.assuntoId) {
      const assunto = assuntos.get(block.assuntoId);
      if (!assunto) return { blockId: block.id, status: 'MISSING', detail: 'assunto' };
      if (assunto.editalDisciplineId !== block.editalDisciplineId) {
        return { blockId: block.id, status: 'INVALID_SCOPE', detail: 'assunto' };
      }
      if (archived.has(assunto.id)) {
        return { blockId: block.id, status: 'ARCHIVED', detail: 'assunto' };
      }
    }
    if (block.aulaId) {
      const aula = aulas.get(block.aulaId);
      if (!aula) return { blockId: block.id, status: 'MISSING', detail: 'aula' };
      if (aula.editalDisciplineId !== block.editalDisciplineId) {
        return { blockId: block.id, status: 'INVALID_SCOPE', detail: 'aula' };
      }
      if (archived.has(aula.id)) {
        return { blockId: block.id, status: 'ARCHIVED', detail: 'aula' };
      }
    }
    return { blockId: block.id, status: 'VALID', detail: 'ok' };
  });
}

/** Blocks that must be reconciled before generating, activating or applying. */
export function blocksNeedingReconciliation(
  checks: ContentLinkCheck[],
): string[] {
  return checks.filter((check) => check.status !== 'VALID').map((check) => check.blockId);
}
