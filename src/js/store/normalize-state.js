// =============================================
// STATE NORMALIZATION UTILITIES
// =============================================
import { DEFAULT_SCHEMA_VERSION } from './migrations.js';

/**
 * Deep clone helper para prevenir mutação de estado
 * Usa structuredClone se disponível, fallback para JSON parse/stringify
 * @param {any} obj - Objeto para clonar
 * @returns {any} - Cópia profunda do objeto
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  // structuredClone é mais preciso e suporta mais tipos
  if (typeof structuredClone === 'function') {
    return structuredClone(obj);
  }
  // Fallback para JSON (funciona para objetos JSON-serializáveis)
  return JSON.parse(JSON.stringify(obj));
}

export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

export function checksumString(value) {
  const text = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createLocalStateEnvelope(sourceState, options = {}) {
  const payload = deepClone(sourceState);
  return {
    version: 1,
    slot: options.slot || 'current',
    schemaVersion: payload?.schemaVersion || DEFAULT_SCHEMA_VERSION,
    savedAt: options.savedAt || new Date().toISOString(),
    checksum: checksumString(payload),
    payload,
  };
}

export function isLocalStateEnvelopeValid(envelope) {
  if (!envelope || envelope.version !== 1 || !envelope.payload) return false;
  if (!envelope.schemaVersion || envelope.schemaVersion !== envelope.payload.schemaVersion)
    return false;
  return envelope.checksum === checksumString(envelope.payload);
}

export function pickRecoverableLocalState({ current, previous, legacy, emergency } = {}) {
  if (isLocalStateEnvelopeValid(current)) return { source: 'current', state: current.payload };
  if (isLocalStateEnvelopeValid(previous)) return { source: 'previous', state: previous.payload };
  if (legacy && typeof legacy === 'object') return { source: 'legacy', state: legacy };
  if (emergency && typeof emergency === 'object') return { source: 'emergency', state: emergency };
  return { source: 'empty', state: null };
}
