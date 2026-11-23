import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { afterAll, describe, expect, it, vi } from 'vitest';
import {
  createEmulatorGateway,
  runCommand,
} from '../../scripts/v1-sync-migration.mjs';

const now = () => Date.UTC(2026, 10, 23, 13, 0, 0);
let directory;

function syntheticBackup() {
  const raw = {
    schemaVersion: 12,
    editais: [{
      id: 101,
      disciplinas: [{
        id: 'disc-1',
        aulas: [{ id: 'aula-1' }],
        assuntos: [{ id: 'assunto-1' }],
      }],
    }],
    eventos: [{ id: 'event-1' }],
    habitos: { questoes: [{ id: 'habit-1' }] },
    planejamento: { retaFinal: { blocos: [{ id: 'block-1' }] } },
    planejamentoArquivado: null,
    ciclo: null,
    cronoLivre: { tempoAcumulado: 0 },
    bancaRelevance: null,
    config: { entityTombstones: [{ collection: 'eventos', id: 'deleted-1' }] },
    syncTombstones: [{ col: 'eventos', id: 'deleted-2' }],
  };
  const bytes = Buffer.from(JSON.stringify(raw), 'utf8');
  return { raw, bytes, sha256: createHash('sha256').update(bytes).digest('hex') };
}

async function execute(command, uid, backupPath, sha256, stateDirectory, gateway, extra = []) {
  const output = vi.fn();
  const exitCode = await runCommand([
    command,
    '--target', 'emulator',
    '--backup', backupPath,
    '--expected-sha256', sha256,
    '--state-dir', stateDirectory,
    '--uid', uid,
    '--project', 'demo-estudo-v1-sync',
    ...extra,
  ], {}, { gateway, now, output });
  return { exitCode, result: output.mock.calls.at(-1)?.[0] };
}

afterAll(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});

describe('V1 migration against Firestore Emulator', () => {
  it('prepares in resumable batches, verifies every document and activates idempotently', async () => {
    directory = await mkdtemp(join(tmpdir(), 'estudo-v1-migration-emulator-'));
    const backup = syntheticBackup();
    const backupPath = join(directory, 'backup.json');
    const stateDirectory = join(directory, 'state');
    await writeFile(backupPath, backup.bytes);

    const uid = `migration-user-${Date.now()}`;
    const gateway = createEmulatorGateway({
      uid,
      projectId: 'demo-estudo-v1-sync',
      emulatorHost: process.env.FIRESTORE_EMULATOR_HOST,
    });

    const first = await execute('prepare', uid, backupPath, backup.sha256, stateDirectory,
      gateway, ['--batch-size', '2']);
    expect(first.result, JSON.stringify(first.result)).toMatchObject({ status: 'VERIFIED' });
    expect(first.exitCode).toBe(0);
    expect(first.result.status).toBe('VERIFIED');

    const verified = await execute('verify', uid, backupPath, backup.sha256, stateDirectory, gateway);
    expect(verified.exitCode).toBe(0);
    expect(verified.result.documentsRead).toBe(14);
    expect(Object.values(verified.result.actualCounts).reduce((sum, count) => sum + count, 0))
      .toBe(14);

    const repeated = await execute('prepare', uid, backupPath, backup.sha256, stateDirectory,
      gateway, ['--batch-size', '2']);
    expect(repeated.result.status).toBe('ALREADY_VERIFIED');

    const activated = await execute('activate', uid, backupPath, backup.sha256,
      stateDirectory, gateway);
    expect(activated.exitCode).toBe(0);
    expect(activated.result.status).toBe('ACTIVE');
    const control = await gateway.getDocument(['v1SyncControl', 'current']);
    expect(control.data.generationId).toBe(activated.result.generationId);
  });
});
