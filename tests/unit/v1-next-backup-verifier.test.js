import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';
import * as codec from '../../src/js/sync/v1-next/backup-codec.js';
import {
  CANONICAL_BACKUP_EXPECTATIONS,
  main,
  runPrivateVerification,
  verifyBackupBytes,
} from '../../scripts/verify-v1-backup.mjs';

// A tiny invented backup, held in memory only. No file I/O, environment reads or real backup.
function synthetic() {
  const raw = {
    schemaVersion: 12,
    editais: [{ id: 'synthetic-edital', disciplinas: [{ id: 'synthetic-disciplina',
      aulas: [{ id: 'synthetic-aula' }], assuntos: [{ id: 'synthetic-assunto' }],
    }] }],
    eventos: [{ id: 'synthetic-evento', aulaId: 'synthetic-historical-aula',
      rfBlocoId: 'synthetic-historical-bloco' }],
    habitos: { questoes: [{ id: 'synthetic-habito', eventoId: 'synthetic-evento' }] },
    planejamento: { tipo: 'reta_final', retaFinal: { blocos: [{ id: 'synthetic-bloco' }] } },
    planejamentoArquivado: { tipo: 'ciclo' },
    config: { cfLastError: 'SYNTHETIC_ERROR_ONLY',
      entityTombstones: [{ entityType: 'evento', entityId: 'synthetic-old-config' }] },
    syncTombstones: [{ col: 'eventos', id: 'synthetic-old-root' }],
  };
  const bytes = Buffer.from(JSON.stringify(raw, null, 2), 'utf8');
  const expected = {
    sizeBytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    businessCounts: { editais: 1, disciplinas: 1, aulas: 1, assuntos: 1, eventos: 1,
      habitos: 1, retaFinalBlocos: 1, tombstones: 2, planejamentoArquivado: 1 },
    tombstonesByOrigin: { root: 1, config: 1 },
    habitCounts: { questoes: 1, revisao: 0, discursiva: 0, simulado: 0, leitura: 0,
      informativo: 0, sumula: 0, videoaula: 0, paginas: 0 },
    historicalUnresolvedReferences: { aulaId: 1, rfBlocoId: 1 },
    rfBlocoIdPresent: 1,
    habitEventsUnresolved: 0,
  };
  return { bytes, expected };
}

describe('V1 optional private backup verifier', () => {
  it('starts disabled and never calls the file reader without explicit authorization', async () => {
    const readBytes = vi.fn(() => { throw new Error('Reader must stay disabled'); });
    expect(await runPrivateVerification({ readBytes })).toEqual({ status: 'DISABLED', checks: [] });
    expect(await runPrivateVerification({ backupPath: 'synthetic-path', readBytes }))
      .toEqual({ status: 'DISABLED', checks: [] });
    expect(readBytes).not.toHaveBeenCalled();
    const env = new Proxy({}, { get() { throw new Error('Environment must not be read'); } });
    const output = vi.fn();
    expect(await main([], env, output)).toBe(0);
    expect(output).toHaveBeenCalledWith({ status: 'DISABLED', checks: [] });
  });

  it('pins the canonical expected byte size, hash, origin counts and historical references', () => {
    expect(CANONICAL_BACKUP_EXPECTATIONS).toMatchObject({
      sizeBytes: 1653120,
      sha256: 'f4f9af2923d3b0da9599de32e1c897ae4ef4690339b63ba1a5a9ba0059844127',
      businessCounts: { editais: 4, disciplinas: 49, aulas: 792, assuntos: 1825,
        eventos: 360, habitos: 222, retaFinalBlocos: 140, tombstones: 5, planejamentoArquivado: 1 },
      tombstonesByOrigin: { root: 3, config: 2 },
      historicalUnresolvedReferences: { aulaId: 57, rfBlocoId: 86 }, rfBlocoIdPresent: 226,
    });
  });

  it('checks original bytes, counts by origin/type, references and reconstructed equivalence', () => {
    const { bytes, expected } = synthetic();
    const result = verifyBackupBytes(bytes, expected);
    expect(result.status).toBe('PASS');
    expect(result.checks.every(check => check.ok)).toBe(true);
    expect(result.checks.map(check => check.check)).toEqual(expect.arrayContaining([
      'sizeBytes', 'sha256', 'schemaAndConversion', 'businessCounts', 'tombstonesByOrigin',
      'habitCounts', 'historicalUnresolvedReferences', 'rfBlocoIdPresent', 'habitEventsUnresolved',
      'businessEquivalence', 'businessDigest',
    ]));
    const output = JSON.stringify(result);
    expect(output.includes('synthetic-')).toBe(false);
    expect(output.includes('SYNTHETIC_ERROR_ONLY')).toBe(false);
    expect(output.includes('records')).toBe(false);
  });

  it('rejects equivalent JSON with changed original bytes before conversion', () => {
    const { bytes, expected } = synthetic();
    const changed = Buffer.from(JSON.stringify(JSON.parse(bytes.toString('utf8'))));
    const convert = vi.spyOn(codec, 'convertBackupV12');
    const result = verifyBackupBytes(changed, expected);
    expect(result.status).toBe('FAIL');
    expect(result.checks.find(check => check.check === 'sha256').ok).toBe(false);
    expect(convert).not.toHaveBeenCalled();
  });

  it.each(['businessCounts', 'tombstonesByOrigin', 'habitCounts', 'historicalUnresolvedReferences'])(
    'rejects mismatched aggregate %s', field => {
      const { bytes, expected } = synthetic();
      const first = Object.keys(expected[field])[0];
      expected[field][first]++;
      const result = verifyBackupBytes(bytes, expected);
      expect(result.status).toBe('FAIL');
      expect(result.checks.find(check => check.check === field).ok).toBe(false);
    });

  it('detects business loss during reconstruction without printing a payload or dynamic key', () => {
    const { bytes, expected } = synthetic();
    const realReconstitute = codec.reconstituteBackupV12;
    vi.spyOn(codec, 'reconstituteBackupV12').mockImplementation(records => {
      const restored = realReconstitute(records);
      restored.eventos[0].aulaId = null;
      return restored;
    });
    const result = verifyBackupBytes(bytes, expected);
    expect(result.status).toBe('FAIL');
    expect(result.checks.find(check => check.check === 'businessEquivalence').ok).toBe(false);
    expect(JSON.stringify(result).includes('synthetic-')).toBe(false);
  });

  it('requires authorization and a path, and returns only a generic failure on read errors', async () => {
    const readBytes = vi.fn(() => { throw new Error('SYNTHETIC_PRIVATE_PATH_OR_CONTENT'); });
    const missing = await runPrivateVerification({ authorized: true, readBytes });
    expect(missing.status).toBe('FAIL');
    expect(readBytes).not.toHaveBeenCalled();
    const failed = await runPrivateVerification({ authorized: true, backupPath: 'synthetic-path', readBytes });
    expect(failed.status).toBe('FAIL');
    expect(JSON.stringify(failed).includes('SYNTHETIC_PRIVATE_PATH_OR_CONTENT')).toBe(false);
    expect(JSON.stringify(failed).includes('synthetic-path')).toBe(false);
    const { bytes, expected } = synthetic();
    const result = await runPrivateVerification({ authorized: true, backupPath: 'synthetic-path',
      readBytes: vi.fn(async () => bytes), expected });
    expect(result.status).toBe('PASS');
  });

  it('handles invalid JSON and validator failures with fixed diagnostics only', () => {
    for (const text of ['{"SYNTHETIC_DYNAMIC_KEY_ONLY":', '{"schemaVersion":11}']) {
      const bytes = Buffer.from(text);
      const expected = { ...synthetic().expected, sizeBytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex') };
      const result = verifyBackupBytes(bytes, expected);
      expect(result.status).toBe('FAIL');
      expect(JSON.stringify(result).includes('SYNTHETIC_DYNAMIC_KEY_ONLY')).toBe(false);
    }
  });

  it('routes CLI arg/env paths only after the explicit authorization flag, without echoing them', async () => {
    const readBytes = vi.fn(() => { throw new Error('SYNTHETIC_PRIVATE_READER_ERROR'); });
    const output = vi.fn();
    const env = { ESTUDO_V1_BACKUP_PATH: 'SYNTHETIC_ENV_PATH' };
    expect(await main(['--path', 'SYNTHETIC_ARG_PATH'], env, output, readBytes)).toBe(0);
    expect(readBytes).not.toHaveBeenCalled();
    expect(await main(['--authorize-private-read', '--path', 'SYNTHETIC_ARG_PATH'], env, output, readBytes)).toBe(1);
    expect(readBytes).toHaveBeenLastCalledWith('SYNTHETIC_ARG_PATH');
    expect(await main(['--authorize-private-read'], env, output, readBytes)).toBe(1);
    expect(readBytes).toHaveBeenLastCalledWith('SYNTHETIC_ENV_PATH');
    readBytes.mockClear();
    expect(await main(['--authorize-private-read', '--unknown'], env, output, readBytes)).toBe(1);
    expect(readBytes).not.toHaveBeenCalled();
    expect(JSON.stringify(output.mock.calls)).not.toMatch(/SYNTHETIC_/);
  });

  it('does not treat truthy non-boolean authorization as consent', async () => {
    const readBytes = vi.fn();
    expect(await runPrivateVerification({ authorized: 'false', backupPath: 'synthetic-path', readBytes }))
      .toEqual({ status: 'DISABLED', checks: [] });
    expect(readBytes).not.toHaveBeenCalled();
  });

  it('checks byte size independently of hash and reference counts independently of aggregates', () => {
    for (const field of ['sizeBytes', 'rfBlocoIdPresent', 'habitEventsUnresolved']) {
      const { bytes, expected } = synthetic();
      expected[field]++;
      const result = verifyBackupBytes(bytes, expected);
      expect(result.status).toBe('FAIL');
      expect(result.checks.find(check => check.check === field).ok).toBe(false);
    }
  });
});
