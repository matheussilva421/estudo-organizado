import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  COLLECTION_NAMES,
  auditBackupBytes,
  createEmulatorGateway,
  runCommand,
} from '../../scripts/v1-sync-migration.mjs';

const now = () => Date.UTC(2026, 10, 23, 12, 0, 0);
const temporaryDirectories = [];

function clone(value) {
  return structuredClone(value);
}

function pathKey(path) {
  return JSON.stringify(path);
}

class MemoryGateway {
  constructor() {
    this.documents = new Map();
    this.commitCalls = [];
    this.listCalls = [];
    this.failOnCommit = null;
    this.sequence = 0;
  }

  async getDocument(path) {
    const stored = this.documents.get(pathKey(path));
    return stored ? clone(stored) : null;
  }

  async listDocuments(path) {
    this.listCalls.push(clone(path));
    const prefix = `${pathKey(path).slice(0, -1)},`;
    return [...this.documents.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .filter(([key]) => JSON.parse(key).length === path.length + 1)
      .map(([, value]) => clone(value))
      .sort((left, right) => left.path.join('/').localeCompare(right.path.join('/')));
  }

  async commit(writes) {
    this.commitCalls.push(clone(writes));
    if (this.failOnCommit === this.commitCalls.length) {
      throw Object.assign(new Error('Synthetic interrupted commit'), { code: 'SYNTHETIC_COMMIT' });
    }
    for (const write of writes) {
      const current = this.documents.get(pathKey(write.path));
      if (write.type === 'create' && current) {
        throw Object.assign(new Error('Synthetic duplicate'), { code: 'GATEWAY_PRECONDITION' });
      }
      if (write.type === 'overwrite' &&
        (!current || current.updateTime !== write.expectedUpdateTime)) {
        throw Object.assign(new Error('Synthetic stale write'), { code: 'GATEWAY_PRECONDITION' });
      }
    }
    for (const write of writes) {
      this.sequence += 1;
      this.documents.set(pathKey(write.path), {
        path: clone(write.path),
        data: clone(write.data),
        updateTime: `memory-${this.sequence}`,
      });
    }
  }

  remove(path) {
    this.documents.delete(pathKey(path));
  }

  replace(path, update) {
    const current = this.documents.get(pathKey(path));
    this.sequence += 1;
    this.documents.set(pathKey(path), {
      path: clone(path),
      data: update(clone(current.data)),
      updateTime: `memory-${this.sequence}`,
    });
  }
}

function syntheticBackup() {
  const raw = {
    schemaVersion: 12,
    editais: [{
      id: 'private-edital',
      nome: 'PRIVATE_EDITAL_NAME',
      disciplinas: [{
        id: 'private-disciplina',
        aulas: [{ id: 'private-aula', nome: 'PRIVATE_AULA_NAME' }],
        assuntos: [{ id: 'private-assunto', nome: 'PRIVATE_ASSUNTO_NAME' }],
      }],
    }],
    eventos: [{ id: 'private-evento', nome: 'PRIVATE_EVENT_NAME' }],
    habitos: {
      questoes: [{ id: 'private-habito', nome: 'PRIVATE_HABIT_NAME' }],
    },
    planejamento: {
      tipo: 'reta_final',
      retaFinal: { blocos: [{ id: 'private-bloco', nome: 'PRIVATE_BLOCK_NAME' }] },
    },
    planejamentoArquivado: null,
    ciclo: null,
    cronoLivre: { tempoAcumulado: 0 },
    bancaRelevance: null,
    config: {
      cfLastError: 'PRIVATE_TRANSIENT_ERROR',
      entityTombstones: [{ collection: 'eventos', id: 'private-deleted-config' }],
    },
    syncTombstones: [{ col: 'eventos', id: 'private-deleted-root' }],
  };
  const bytes = Buffer.from(JSON.stringify(raw, null, 2), 'utf8');
  const expectedSha256 = createHash('sha256').update(bytes).digest('hex');
  return { raw, bytes, expectedSha256 };
}

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'estudo-v1-migration-unit-'));
  temporaryDirectories.push(directory);
  const backup = syntheticBackup();
  const backupPath = join(directory, 'backup.json');
  await writeFile(backupPath, backup.bytes);
  return {
    ...backup,
    directory,
    backupPath,
    stateDirectory: join(directory, 'state'),
    gateway: new MemoryGateway(),
  };
}

function commandArgs(command, context, extra = []) {
  return [
    command,
    '--target', 'emulator',
    '--backup', context.backupPath,
    '--expected-sha256', context.expectedSha256,
    '--state-dir', context.stateDirectory,
    '--uid', 'synthetic-user',
    '--project', 'demo-estudo-v1-sync',
    '--emulator-host', '127.0.0.1:8085',
    ...extra,
  ];
}

async function execute(command, context, extra = []) {
  const output = vi.fn();
  const exitCode = await runCommand(commandArgs(command, context, extra), {}, {
    gateway: context.gateway,
    now,
    output,
  });
  return { exitCode, result: output.mock.calls.at(-1)?.[0] };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory =>
    rm(directory, { recursive: true, force: true })));
});

describe('V1 migration CLI', () => {
  it('rejects an unexpected source hash before parsing or converting', () => {
    const { bytes } = syntheticBackup();
    const result = auditBackupBytes(bytes, { expectedSha256: '0'.repeat(64) });
    expect(result.status).toBe('FAIL');
    expect(result.checks.find(check => check.check === 'sha256')?.ok).toBe(false);
    expect(result.checks.some(check => check.check === 'schemaAndConversion')).toBe(false);
  });

  it('rejects an invalid schema with fixed diagnostics and no private values', () => {
    const bytes = Buffer.from(JSON.stringify({ schemaVersion: 11 }), 'utf8');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const result = auditBackupBytes(bytes, { expectedSha256: sha256 });
    expect(result.status).toBe('FAIL');
    expect(result.checks.find(check => check.check === 'schemaAndConversion')?.ok).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/schemaVersion|PRIVATE_|private-/);
  });

  it('prepares, fully reads back all collections and keeps the technical journal private', async () => {
    const context = await fixture();
    const prepared = await execute('prepare', context, ['--batch-size', '2']);
    expect(prepared.exitCode).toBe(0);
    expect(prepared.result.status).toBe('VERIFIED');

    context.gateway.listCalls.length = 0;
    const verified = await execute('verify', context);
    expect(verified.exitCode).toBe(0);
    expect(verified.result.status).toBe('PASS');
    expect(verified.result.documentsRead).toBe(14);
    expect(context.gateway.listCalls.map(path => path.at(-1)).sort())
      .toEqual([...COLLECTION_NAMES].sort());

    const journal = await readFile(join(context.stateDirectory, 'journal.json'), 'utf8');
    expect(journal).not.toMatch(/private-|PRIVATE_|backup\.json/);
  });

  it('detects divergent manifest counts before accepting read-back', async () => {
    const context = await fixture();
    expect((await execute('prepare', context)).exitCode).toBe(0);
    const prepared = JSON.parse(await readFile(join(context.stateDirectory, 'journal.json'), 'utf8'));
    const manifestPath = ['v1SyncNamespaces', prepared.generationId];
    context.gateway.replace(manifestPath, manifest => ({
      ...manifest,
      counts: { ...manifest.counts, total: manifest.counts.total + 1 },
    }));

    const verified = await execute('verify', context);
    expect(verified.exitCode).toBe(1);
    expect(verified.result.status).toBe('FAIL');
    expect(verified.result.checks.find(check => check.check === 'counts')?.ok).toBe(false);
  });

  it('resumes an interrupted multi-batch prepare without duplicating records', async () => {
    const context = await fixture();
    context.gateway.failOnCommit = 3;
    const interrupted = await execute('prepare', context, ['--batch-size', '2']);
    expect(interrupted.exitCode).toBe(1);
    expect(interrupted.result.status).toBe('FAIL');

    const before = context.gateway.documents.size;
    context.gateway.failOnCommit = null;
    const resumed = await execute('prepare', context, ['--batch-size', '2']);
    expect(resumed.exitCode).toBe(0);
    expect(resumed.result.status).toBe('VERIFIED');
    expect(context.gateway.documents.size).toBeGreaterThan(before);

    const countBeforeRepeat = context.gateway.documents.size;
    const repeated = await execute('prepare', context, ['--batch-size', '2']);
    expect(repeated.result.status).toBe('ALREADY_VERIFIED');
    expect(context.gateway.documents.size).toBe(countBeforeRepeat);

    const records = [...context.gateway.documents.values()]
      .filter(item => item.data?.schemaVersion === 1 && Object.hasOwn(item.data, 'baseRevision'));
    expect(records.every(item => item.data.revision === 1 && item.data.baseRevision === 0)).toBe(true);
  });

  it('detects a missing document by collection without exposing its identity', async () => {
    const context = await fixture();
    expect((await execute('prepare', context)).exitCode).toBe(0);
    const event = [...context.gateway.documents.values()]
      .find(item => item.path.includes('eventos'));
    context.gateway.remove(event.path);

    const verified = await execute('verify', context);
    expect(verified.exitCode).toBe(1);
    expect(verified.result.missingByCollection.eventos).toBe(1);
    expect(JSON.stringify(verified.result)).not.toMatch(/private-|PRIVATE_/);
  });

  it('detects a divergent payload digest as an invalid record', async () => {
    const context = await fixture();
    expect((await execute('prepare', context)).exitCode).toBe(0);
    const record = [...context.gateway.documents.values()]
      .find(item => item.path.includes('eventos'));
    context.gateway.replace(record.path, data => ({ ...data, opDigest: '0'.repeat(64) }));

    const verified = await execute('verify', context);
    expect(verified.exitCode).toBe(1);
    expect(verified.result.status).toBe('FAIL');
    expect(verified.result.invalidByCollection.eventos).toBe(1);
  });

  it('detects an absent historical tombstone during complete read-back', async () => {
    const context = await fixture();
    expect((await execute('prepare', context)).exitCode).toBe(0);
    const tombstone = [...context.gateway.documents.values()]
      .find(item => item.path.includes('tombstones'));
    context.gateway.remove(tombstone.path);

    const verified = await execute('verify', context);
    expect(verified.exitCode).toBe(1);
    expect(verified.result.missingByCollection.tombstones).toBe(1);
    expect(verified.result.checks.find(check => check.check === 'businessDigest')?.ok).toBe(false);
  });

  it('always refuses production activation before reading or writing anything', async () => {
    const readFileSpy = vi.fn(() => { throw new Error('must not read'); });
    const output = vi.fn();
    const exitCode = await runCommand([
      'activate', '--target', 'production', '--backup', 'PRIVATE_PATH',
      '--state-dir', 'PRIVATE_STATE', '--uid', 'PRIVATE_UID', '--force',
    ], {}, { readFile: readFileSpy, output });
    expect(exitCode).toBe(1);
    expect(output).toHaveBeenCalledWith(expect.objectContaining({
      status: 'REFUSED', code: 'PRODUCTION_ACTIVATION_DISABLED',
    }));
    expect(readFileSpy).not.toHaveBeenCalled();
    expect(JSON.stringify(output.mock.calls)).not.toMatch(/PRIVATE_/);
  });

  it('restricts the administrative adapter to loopback and demo projects', () => {
    expect(() => createEmulatorGateway({
      uid: 'synthetic-user',
      projectId: 'real-production-project',
      emulatorHost: '127.0.0.1:8085',
    })).toThrow('EMULATOR_DEMO_PROJECT_REQUIRED');
    expect(() => createEmulatorGateway({
      uid: 'synthetic-user',
      projectId: 'demo-estudo-v1-sync',
      emulatorHost: '10.0.0.2:8085',
    })).toThrow('INVALID_EMULATOR_HOST');
  });
});
