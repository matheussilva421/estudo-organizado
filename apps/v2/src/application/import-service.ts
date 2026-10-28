import { canonicalJson, sha256Hex } from '../platform/backup/format';
import type { StudySubject } from '../domain/subject';
import type { Edital, EditalDiscipline } from '../domain/edital';
import type { Assunto, Aula } from '../domain/content';
import {
  IMPORT_MAX_BYTES,
  IMPORT_MAX_DEPTH,
  IMPORT_MAX_ENTITIES,
  IMPORT_MAX_KEY,
  IMPORT_MAX_TITLE,
  type ImportConflict,
  type ImportPreview,
  type ParsedDiscipline,
  type ParsedEdital,
  type ParsedLesson,
  type ParsedTopic,
  type ParseResult,
  type PreviewAmbiguity,
  type PreviewCreate,
  type PreviewMatch,
  type QuarantineEntry,
  type SourceIdentity,
} from './import-types';

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const ACTIVE_MARKUP = /<script|<iframe|javascript:|onerror=|onload=/i;

export function nameKeyOf(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, IMPORT_MAX_KEY);
}

export function qualifiedIdentity(namespace: string, centralId: string | null, sourceRef: string | null): string | null {
  if (centralId) return `${namespace}:${centralId}`;
  if (sourceRef) return `${namespace}#${sourceRef}`;
  return null;
}

export function fingerprintOf(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasUnsafeKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasUnsafeKey);
  if (!isRecord(value)) return false;
  for (const [key, child] of Object.entries(value)) {
    if (UNSAFE_KEYS.has(key)) return true;
    if (hasUnsafeKey(child)) return true;
  }
  return false;
}

function decodeInput(input: Uint8Array | string): { ok: true; text: string } | { ok: false; reason: 'TOO_LARGE' | 'NOT_JSON' } {
  if (typeof input === 'string') {
    if (new TextEncoder().encode(input).length > IMPORT_MAX_BYTES) {
      return { ok: false, reason: 'TOO_LARGE' };
    }
    return { ok: true, text: input };
  }
  if (input.byteLength > IMPORT_MAX_BYTES) return { ok: false, reason: 'TOO_LARGE' };
  try {
    return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(input) };
  } catch {
    return { ok: false, reason: 'NOT_JSON' };
  }
}

function textField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export type ParseOptions = {
  namespace: string;
};

/**
 * Pure JSON reader: never opens IndexedDB, never executes content. `centralId`
 * and `sourceRef` are only authoritative inside the caller's namespace.
 */
export function parseEditalImport(
  input: Uint8Array | string | unknown,
  options: ParseOptions,
): ParseResult {
  const namespace = textField(options?.namespace);
  if (!namespace) return { ok: false, reason: 'INVALID_STRUCTURE', detail: 'namespace' };

  let value: unknown = input;
  if (typeof input === 'string' || input instanceof Uint8Array) {
    const decoded = decodeInput(input);
    if (!decoded.ok) return { ok: false, reason: decoded.reason };
    try {
      value = JSON.parse(decoded.text) as unknown;
    } catch {
      return { ok: false, reason: 'NOT_JSON' };
    }
  }

  if (!isRecord(value)) return { ok: false, reason: 'NOT_OBJECT' };
  if (hasUnsafeKey(value)) return { ok: false, reason: 'UNSAFE_KEY' };

  const version = value.versao ?? value.formatVersion ?? value.sourceFormatVersion;
  if (version !== 1) return { ok: false, reason: 'UNSUPPORTED_VERSION' };
  const kind = value.tipo ?? value.kind ?? value.type;
  if (kind !== 'edital') return { ok: false, reason: 'UNSUPPORTED_KIND' };

  const name = textField(value.nome ?? value.name ?? value.titulo);
  if (!name) return { ok: false, reason: 'MISSING_NAME' };
  if (name.length > IMPORT_MAX_TITLE) return { ok: false, reason: 'TITLE_TOO_LONG' };

  const rawDisciplines = value.disciplinas ?? value.disciplines;
  if (!Array.isArray(rawDisciplines) || rawDisciplines.length === 0) {
    return { ok: false, reason: 'NO_DISCIPLINES' };
  }

  const quarantined: QuarantineEntry[] = [];
  const suspicious: string[] = [];
  let entityCount = 0;
  let maxDepth = 0;

  const readTopics = (
    raw: unknown,
    path: string,
    depth: number,
  ): ParsedTopic[] => {
    if (raw === undefined) return [];
    if (!Array.isArray(raw)) {
      quarantined.push({ path, reason: 'TOPICS_NOT_ARRAY' });
      return [];
    }
    if (depth > IMPORT_MAX_DEPTH) {
      quarantined.push({ path, reason: 'DEPTH_LIMIT' });
      return [];
    }
    maxDepth = Math.max(maxDepth, depth);
    const topics: ParsedTopic[] = [];
    raw.forEach((item, index) => {
      const itemPath = `${path}[${index}]`;
      if (!isRecord(item)) {
        quarantined.push({ path: itemPath, reason: 'NOT_AN_OBJECT' });
        return;
      }
      const topicName = textField(item.nome ?? item.name ?? item.titulo);
      if (!topicName) {
        quarantined.push({ path: itemPath, reason: 'MISSING_NAME' });
        return;
      }
      if (topicName.length > IMPORT_MAX_TITLE) {
        quarantined.push({ path: itemPath, reason: 'TITLE_TOO_LONG', name: topicName });
        return;
      }
      if (ACTIVE_MARKUP.test(topicName)) suspicious.push(topicName);
      entityCount += 1;
      topics.push({
        name: topicName,
        nameKey: nameKeyOf(topicName),
        children: readTopics(item.filhos ?? item.children ?? item.subtopicos, `${itemPath}.filhos`, depth + 1),
      });
    });
    return topics;
  };

  const readLessons = (raw: unknown, path: string): ParsedLesson[] => {
    if (raw === undefined) return [];
    if (!Array.isArray(raw)) {
      quarantined.push({ path, reason: 'LESSONS_NOT_ARRAY' });
      return [];
    }
    const lessons: ParsedLesson[] = [];
    raw.forEach((item, index) => {
      const itemPath = `${path}[${index}]`;
      if (!isRecord(item)) {
        quarantined.push({ path: itemPath, reason: 'NOT_AN_OBJECT' });
        return;
      }
      const lessonName = textField(item.nome ?? item.name ?? item.titulo);
      if (!lessonName) {
        quarantined.push({ path: itemPath, reason: 'MISSING_NAME' });
        return;
      }
      if (lessonName.length > IMPORT_MAX_TITLE) {
        quarantined.push({ path: itemPath, reason: 'TITLE_TOO_LONG', name: lessonName });
        return;
      }
      if (ACTIVE_MARKUP.test(lessonName)) suspicious.push(lessonName);
      entityCount += 1;
      const centralId = textField(item.centralId ?? item.id);
      const sourceRef = textField(item.sourceRef ?? item.referencia);
      lessons.push({
        name: lessonName,
        nameKey: nameKeyOf(lessonName),
        ...(centralId ? { centralId: centralId.slice(0, IMPORT_MAX_KEY) } : {}),
        ...(sourceRef ? { sourceRef: sourceRef.slice(0, IMPORT_MAX_KEY) } : {}),
      });
    });
    return lessons;
  };

  const disciplines: ParsedDiscipline[] = [];
  for (const [index, raw] of rawDisciplines.entries()) {
    const path = `disciplinas[${index}]`;
    if (!isRecord(raw)) {
      quarantined.push({ path, reason: 'NOT_AN_OBJECT' });
      continue;
    }
    const disciplineName = textField(raw.nome ?? raw.name ?? raw.titulo);
    if (!disciplineName) {
      quarantined.push({ path, reason: 'MISSING_NAME' });
      continue;
    }
    if (disciplineName.length > IMPORT_MAX_TITLE) {
      quarantined.push({ path, reason: 'TITLE_TOO_LONG', name: disciplineName });
      continue;
    }
    if (ACTIVE_MARKUP.test(disciplineName)) suspicious.push(disciplineName);
    entityCount += 1;
    const centralId = textField(raw.centralId ?? raw.id);
    const sourceRef = textField(raw.sourceRef ?? raw.referencia);
    disciplines.push({
      name: disciplineName,
      nameKey: nameKeyOf(disciplineName),
      ...(centralId ? { centralId: centralId.slice(0, IMPORT_MAX_KEY) } : {}),
      ...(sourceRef ? { sourceRef: sourceRef.slice(0, IMPORT_MAX_KEY) } : {}),
      topics: readTopics(raw.topicos ?? raw.topics, `${path}.topicos`, 1),
      lessons: readLessons(raw.aulas ?? raw.lessons, `${path}.aulas`),
    });
  }

  if (disciplines.length === 0) return { ok: false, reason: 'NO_DISCIPLINES' };
  if (entityCount > IMPORT_MAX_ENTITIES) return { ok: false, reason: 'TOO_MANY_ENTITIES' };
  if (maxDepth > IMPORT_MAX_DEPTH) return { ok: false, reason: 'TOO_DEEP' };

  const centralId = textField(value.centralId ?? value.id) || null;
  const sourceRef = textField(value.sourceRef ?? value.referencia) || null;
  const sourceIdentity: SourceIdentity = {
    namespace,
    centralId: centralId ? centralId.slice(0, IMPORT_MAX_KEY) : null,
    sourceRef: sourceRef ? sourceRef.slice(0, IMPORT_MAX_KEY) : null,
    nameKey: nameKeyOf(name),
  };

  // Volatile fields (timestamps, local revisions) are excluded on purpose.
  const fingerprint = fingerprintOf({
    namespace,
    identity: qualifiedIdentity(namespace, sourceIdentity.centralId, sourceIdentity.sourceRef),
    name,
    disciplines,
  });
  const sourceRevision =
    textField(value.revisao ?? value.sourceRevision ?? value.revision) || fingerprint;

  const parsed: ParsedEdital = {
    format: 'legacy-v1',
    sourceIdentity,
    name,
    nameKey: nameKeyOf(name),
    disciplines,
    fingerprint,
    sourceRevision,
    entityCount,
    depth: maxDepth,
    quarantined,
    suspicious,
  };

  return { ok: true, parsed };
}

export type ExistingContent = {
  subjects: StudySubject[];
  editais: Edital[];
  links: EditalDiscipline[];
  assuntos: Assunto[];
  aulas: Aula[];
};

function stableEntityId(fingerprint: string, path: string): string {
  return `imp_${sha256Hex(`${fingerprint}|${path}`).slice(0, 24)}`;
}

export function targetSignatureOf(existing: ExistingContent): string {
  return fingerprintOf({
    subjects: existing.subjects.map((item) => [item.id, item.localRevision]),
    editais: existing.editais.map((item) => [item.id, item.localRevision]),
    links: existing.links.map((item) => [item.id, item.localRevision]),
    assuntos: existing.assuntos.map((item) => [item.id, item.localRevision]),
    aulas: existing.aulas.map((item) => [item.id, item.localRevision]),
  });
}

/**
 * Matching is conservative: only a qualified identity (namespace + id) can
 * reuse an existing edital. A shared display name is reported as ambiguity and
 * never authorizes a merge.
 */
export function previewEditalImport(
  parsed: ParsedEdital,
  existing: ExistingContent,
): ImportPreview {
  const creates: PreviewCreate[] = [];
  const matches: PreviewMatch[] = [];
  const ambiguous: PreviewAmbiguity[] = [];
  const conflicts: ImportConflict[] = [];

  const qualified = qualifiedIdentity(
    parsed.sourceIdentity.namespace,
    parsed.sourceIdentity.centralId,
    parsed.sourceIdentity.sourceRef,
  );
  const existingEdital = qualified
    ? existing.editais.find((item) => item.sourceRef === qualified)
    : undefined;

  let editalId: string;
  if (existingEdital) {
    if (existingEdital.sourceRevision && existingEdital.sourceRevision !== parsed.sourceRevision) {
      conflicts.push({
        targetId: existingEdital.id,
        name: existingEdital.title,
        reason: 'SOURCE_REVISION_DIVERGED',
        incomingRevision: parsed.sourceRevision,
        existingRevision: existingEdital.sourceRevision,
      });
    } else {
      matches.push({
        entityType: 'edital',
        id: existingEdital.id,
        name: existingEdital.title,
        reason: 'SAME_QUALIFIED_IDENTITY',
      });
    }
    editalId = existingEdital.id;
  } else {
    const sameName = existing.editais.filter(
      (item) => nameKeyOf(item.title) === parsed.nameKey,
    );
    if (sameName.length > 0) {
      ambiguous.push({
        name: parsed.name,
        nameKey: parsed.nameKey,
        candidates: sameName.map((item) => item.id),
        reason: 'SAME_NAME_DIFFERENT_SOURCE',
      });
    }
    editalId = stableEntityId(parsed.fingerprint, 'edital');
    creates.push({ entityType: 'edital', id: editalId, name: parsed.name, parentId: null });
  }

  for (const discipline of parsed.disciplines) {
    const disciplinePath = `disciplina:${discipline.nameKey}`;
    const subject = existing.subjects.find((item) => nameKeyOf(item.title) === discipline.nameKey);
    if (subject) {
      ambiguous.push({
        name: discipline.name,
        nameKey: discipline.nameKey,
        candidates: [subject.id],
        reason: 'NAME_ONLY_MATCH',
      });
    }
    const subjectId = subject ? subject.id : stableEntityId(parsed.fingerprint, `subject:${disciplinePath}`);
    if (!subject) {
      creates.push({
        entityType: 'edital-discipline',
        id: subjectId,
        name: discipline.name,
        parentId: editalId,
      });
    }
    const linkId = stableEntityId(parsed.fingerprint, `link:${disciplinePath}`);
    creates.push({
      entityType: 'edital-discipline',
      id: linkId,
      name: discipline.name,
      parentId: editalId,
    });

    const walk = (topics: ParsedTopic[], parentId: string | null, path: string): void => {
      for (const topic of topics) {
        const topicPath = `${path}/${topic.nameKey}`;
        const id = stableEntityId(parsed.fingerprint, `assunto:${topicPath}`);
        creates.push({
          entityType: 'assunto',
          id,
          name: topic.name,
          parentId: parentId ?? linkId,
        });
        walk(topic.children, id, topicPath);
      }
    };
    walk(discipline.topics, null, disciplinePath);

    for (const lesson of discipline.lessons) {
      creates.push({
        entityType: 'aula',
        id: stableEntityId(parsed.fingerprint, `aula:${disciplinePath}/${lesson.nameKey}`),
        name: lesson.name,
        parentId: linkId,
      });
    }
  }

  return {
    importId: `imp_${parsed.fingerprint.slice(0, 24)}`,
    sourceIdentity: parsed.sourceIdentity,
    fingerprint: parsed.fingerprint,
    sourceRevision: parsed.sourceRevision,
    targetSignature: targetSignatureOf(existing),
    creates,
    matches,
    ambiguous,
    conflicts,
    quarantined: parsed.quarantined,
    entityCount: parsed.entityCount,
  };
}
