#!/usr/bin/env node
/**
 * Proves the Reta Final v2 Firestore barrier against an already running local
 * Firestore emulator. This script deliberately does not start or stop any
 * emulator process.
 *
 * Requires the official harness installed locally (not in package.json):
 *   npm install --no-save @firebase/rules-unit-testing@5.0.0
 *
 * Usage:
 *   node scripts/verify-reta-final-rules.mjs --rules firestore.rules
 *   node scripts/verify-reta-final-rules.mjs --rules .tmp/old.rules
 *   node scripts/verify-reta-final-rules.mjs --host 127.0.0.1 --port 8090
 *
 * Exit codes: 0 proven / vulnerability reproduced, 1 assertion failure,
 * 2 NOT_RUN (emulator or harness unavailable).
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const CAPABILITIES = {
  schema: 2,
  granularMerge: true,
  guards: { envelope: 'rules-v2', probe: 1 },
};
const INSTALL_HINT = 'npm install --no-save @firebase/rules-unit-testing@5.0.0';

function parseArgs(argv) {
  const args = { rules: 'firestore.rules', host: '127.0.0.1', port: 8090 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--rules') args.rules = argv[++index];
    else if (arg.startsWith('--rules=')) args.rules = arg.slice('--rules='.length);
    else if (arg === '--host') args.host = argv[++index];
    else if (arg.startsWith('--host=')) args.host = arg.slice('--host='.length);
    else if (arg === '--port') args.port = Number(argv[++index]);
    else if (arg.startsWith('--port=')) args.port = Number(arg.slice('--port='.length));
  }
  return args;
}

function notRun(message) {
  console.error(`NOT_RUN: ${message}`);
  process.exit(2);
}

function plan({ planId = 'plan-1', revision = 2, ativo = true } = {}) {
  return {
    ativo,
    tipo: 'reta_final',
    schemaVersionRetaFinal: 2,
    planId,
    revision,
    retaFinal: { dataFinal: '2026-12-20', blocos: [] },
  };
}

function repeated(char) {
  return char.repeat(32);
}

function envelope({
  planId = 'plan-1',
  lineageId = planId,
  generation = 1,
  revision = 3,
  baseRevision = 2,
  digest = repeated('b'),
  state = 'active',
  payloadUpdatedAt = '2026-10-20T12:00:00.000Z',
  deviceId = 'web-rules-test',
  withDescriptor = true,
} = {}) {
  const value = {
    version: 1,
    schemaVersion: 6,
    deviceId,
    baseRemoteUpdatedAt: null,
    payloadUpdatedAt,
    sentAt: payloadUpdatedAt,
    payload: {
      config: {},
      planejamento: plan({ planId, revision, ativo: state !== 'retired' }),
    },
  };
  if (withDescriptor) {
    value.retaFinalSync = {
      schema: 2,
      planId,
      lineageId,
      generation,
      revision,
      baseRevision,
      baseRemoteUpdatedAt: null,
      digest,
      deviceId,
      capabilities: CAPABILITIES,
      state,
    };
  }
  return value;
}

function legacyEnvelope(payloadUpdatedAt = '2026-10-20T12:30:00.000Z') {
  return {
    version: 1,
    schemaVersion: 6,
    deviceId: 'legacy-device',
    baseRemoteUpdatedAt: null,
    payloadUpdatedAt,
    sentAt: payloadUpdatedAt,
    payload: { config: {}, planejamento: plan({ revision: 1 }) },
  };
}

function guardDoc(deviceId = 'web-rules-test') {
  return {
    schema: 2,
    guardVersion: 1,
    deviceId,
    checkedAt: new Date().toISOString(),
  };
}

function firestoreCode(error) {
  return String(error?.code || error?.message || error).toLowerCase();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rulesPath = path.resolve(args.rules);
  if (!fs.existsSync(rulesPath)) notRun(`rules file not found: ${rulesPath}`);
  const rulesText = fs.readFileSync(rulesPath, 'utf8');
  const newRules = rulesText.includes('retaFinalSync');
  const projectId = newRules ? 'demo-reta-final-new' : 'demo-reta-final-legacy';

  let testing;
  try {
    testing = await import('@firebase/rules-unit-testing');
  } catch (error) {
    notRun(`@firebase/rules-unit-testing is not installed locally. Run: ${INSTALL_HINT}`);
  }
  const { initializeTestEnvironment, assertSucceeds } = testing;
  const { doc, setDoc, deleteDoc } = await import('firebase/firestore');

  let environment;
  try {
    environment = await initializeTestEnvironment({
      projectId,
      firestore: {
        host: args.host,
        port: Number(args.port),
        rules: rulesText,
      },
    });
  } catch (error) {
    notRun(
      `emulator unavailable at ${args.host}:${args.port} or rules rejected: ${error.message}`
    );
  }

  const owner = 'uid-owner';
  const intruder = 'uid-intruder';
  const ownerDb = environment.authenticatedContext(owner).firestore();
  const intruderDb = environment.authenticatedContext(intruder).firestore();
  const uidDb = (uid) => environment.authenticatedContext(uid).firestore();

  const results = [];
  const ok = (label, detail = 'allowed') => ({ label, ok: true, detail });
  const failed = (label, detail) => ({ label, ok: false, detail });

  async function expectAllowed(label, operation) {
    try {
      await assertSucceeds(operation());
      return ok(label);
    } catch (error) {
      return failed(label, `expected allow, got ${firestoreCode(error)}`);
    }
  }

  async function expectDenied(label, operation) {
    try {
      await operation();
      return failed(label, 'expected permission-denied, got allowed');
    } catch (error) {
      const code = firestoreCode(error);
      return {
        label,
        ok: code.includes('permission-denied') || code.includes('permission_denied'),
        detail: code,
      };
    }
  }

  const seed = async (uid, value) => {
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', uid, 'snapshots', 'main'), value);
    });
  };

  // Baseline: a valid legacy create must pass, including a plain snapshot.
  results.push(
    await expectAllowed('minimal legacy snapshot', () =>
      setDoc(doc(uidDb('uid-minimal'), 'users', 'uid-minimal', 'snapshots', 'main'), {
        version: 1,
        schemaVersion: 6,
        deviceId: 'legacy-device',
        baseRemoteUpdatedAt: null,
        payloadUpdatedAt: '2026-10-20T10:00:00.000Z',
        sentAt: '2026-10-20T10:00:00.000Z',
        payload: { config: {} },
      })
    )
  );
  results.push(
    await expectAllowed('baseline legacy create', () =>
      setDoc(
        doc(ownerDb, 'users', owner, 'snapshots', 'main'),
        legacyEnvelope('2026-10-20T10:00:00.000Z')
      )
    )
  );

  // 1. Legacy overwrite over a seeded v2 document.
  await seed('uid-legacy-overwrite', envelope({ revision: 2, baseRevision: 1 }));
  const legacyOverwrite = await expectAllowed('legacy overwrite over v2', () =>
    setDoc(
      doc(uidDb('uid-legacy-overwrite'), 'users', 'uid-legacy-overwrite', 'snapshots', 'main'),
      legacyEnvelope('2026-10-20T13:00:00.000Z')
    )
  );
  if (newRules) {
    const holds =
      !legacyOverwrite.ok && legacyOverwrite.detail.includes('permission-denied');
    results.push({
      label: legacyOverwrite.label,
      ok: holds,
      detail: holds ? 'denied (barrier holds)' : legacyOverwrite.detail,
    });
  } else {
    results.push({
      label: legacyOverwrite.label,
      ok: legacyOverwrite.ok,
      detail: legacyOverwrite.ok
        ? 'ALLOWED (vulnerability reproduced)'
        : legacyOverwrite.detail,
    });
  }

  if (!newRules) {
    results.push(
      await expectDenied('guard probe denied by legacy rules', () =>
        setDoc(
          doc(uidDb('uid-guard-legacy'), 'users', 'uid-guard-legacy', 'syncMeta', 'reta-final-guard'),
          guardDoc()
        )
      )
    );
    results.push(
      await expectDenied('intruder cannot write another uid snapshot', () =>
        setDoc(
          doc(intruderDb, 'users', 'uid-legacy-overwrite', 'snapshots', 'main'),
          legacyEnvelope('2026-10-20T14:00:00.000Z')
        )
      )
    );
    report(results, { newRules, host: args.host, port: args.port });
    await environment.clearFirestore();
    await environment.cleanup();
    return;
  }

  // 2. Create, advance and stale base.
  results.push(
    await expectAllowed('v2 create with baseRevision 0', () =>
      setDoc(
        doc(uidDb('uid-create'), 'users', 'uid-create', 'snapshots', 'main'),
        envelope({ revision: 1, baseRevision: 0 })
      )
    )
  );

  await seed('uid-advance', envelope({ revision: 2, baseRevision: 1 }));
  results.push(
    await expectAllowed('v2 advance with correct base', () =>
      setDoc(
        doc(uidDb('uid-advance'), 'users', 'uid-advance', 'snapshots', 'main'),
        envelope({ revision: 3, baseRevision: 2 })
      )
    )
  );

  await seed('uid-stale', envelope({ revision: 3, baseRevision: 2 }));
  results.push(
    await expectDenied('v2 stale base after another write', () =>
      setDoc(
        doc(uidDb('uid-stale'), 'users', 'uid-stale', 'snapshots', 'main'),
        envelope({ revision: 4, baseRevision: 2, digest: repeated('c') })
      )
    )
  );

  // 3. Replay and digest collision.
  await seed('uid-replay', envelope({ revision: 2, baseRevision: 1 }));
  const replay = envelope({ revision: 3, baseRevision: 2, digest: repeated('d') });
  await assertSucceeds(
    setDoc(doc(uidDb('uid-replay'), 'users', 'uid-replay', 'snapshots', 'main'), replay)
  );
  results.push(
    await expectAllowed('v2 identical replay', () =>
      setDoc(doc(uidDb('uid-replay'), 'users', 'uid-replay', 'snapshots', 'main'), replay)
    )
  );
  results.push(
    await expectDenied('v2 same revision different digest', () =>
      setDoc(doc(uidDb('uid-replay'), 'users', 'uid-replay', 'snapshots', 'main'), {
        ...replay,
        retaFinalSync: { ...replay.retaFinalSync, digest: repeated('e') },
      })
    )
  );

  // 4. Rollback and identity changes.
  await seed('uid-rollback', envelope({ revision: 3, baseRevision: 2 }));
  results.push(
    await expectDenied('v2 rollback', () =>
      setDoc(
        doc(uidDb('uid-rollback'), 'users', 'uid-rollback', 'snapshots', 'main'),
        envelope({ revision: 2, baseRevision: 3, digest: repeated('9') })
      )
    )
  );
  results.push(
    await expectDenied('v2 planId change', () =>
      setDoc(
        doc(uidDb('uid-rollback'), 'users', 'uid-rollback', 'snapshots', 'main'),
        envelope({ planId: 'plan-2', revision: 4, baseRevision: 3 })
      )
    )
  );
  results.push(
    await expectDenied('v2 generation change', () =>
      setDoc(
        doc(uidDb('uid-rollback'), 'users', 'uid-rollback', 'snapshots', 'main'),
        envelope({ generation: 2, revision: 4, baseRevision: 3 })
      )
    )
  );

  // 5. Adoption over a legacy document.
  await seed('uid-adopt', legacyEnvelope('2026-10-20T11:00:00.000Z'));
  results.push(
    await expectAllowed('v2 adoption with matching payloadUpdatedAt', () => {
      const value = envelope({ revision: 1, baseRevision: 0 });
      value.retaFinalSync.baseRemoteUpdatedAt = '2026-10-20T11:00:00.000Z';
      return setDoc(doc(uidDb('uid-adopt'), 'users', 'uid-adopt', 'snapshots', 'main'), value);
    })
  );
  await seed('uid-adopt-bad', legacyEnvelope('2026-10-20T11:00:00.000Z'));
  results.push(
    await expectDenied('v2 adoption with divergent payloadUpdatedAt', () => {
      const value = envelope({ revision: 1, baseRevision: 0 });
      value.retaFinalSync.baseRemoteUpdatedAt = '2026-10-20T10:00:00.000Z';
      return setDoc(
        doc(uidDb('uid-adopt-bad'), 'users', 'uid-adopt-bad', 'snapshots', 'main'),
        value
      );
    })
  );

  // 6. Retirement.
  await seed('uid-retire', envelope({ revision: 2, baseRevision: 1 }));
  results.push(
    await expectAllowed('v2 retirement advance', () =>
      setDoc(
        doc(uidDb('uid-retire'), 'users', 'uid-retire', 'snapshots', 'main'),
        envelope({ revision: 3, baseRevision: 2, state: 'retired' })
      )
    )
  );
  results.push(
    await expectDenied('v2 retired resurrection', () =>
      setDoc(
        doc(uidDb('uid-retire'), 'users', 'uid-retire', 'snapshots', 'main'),
        envelope({ revision: 4, baseRevision: 3, state: 'active' })
      )
    )
  );
  results.push(
    await expectDenied('v2 retired create', () =>
      setDoc(
        doc(uidDb('uid-retired-create'), 'users', 'uid-retired-create', 'snapshots', 'main'),
        envelope({ revision: 1, baseRevision: 0, state: 'retired' })
      )
    )
  );

  // 7. Guard and owner scope.
  results.push(
    await expectAllowed('guard create by owner', () =>
      setDoc(
        doc(uidDb('uid-guard'), 'users', 'uid-guard', 'syncMeta', 'reta-final-guard'),
        guardDoc()
      )
    )
  );
  results.push(
    await expectDenied('guard denied to another uid', () =>
      setDoc(
        doc(intruderDb, 'users', 'uid-guard', 'syncMeta', 'reta-final-guard'),
        guardDoc('other-device')
      )
    )
  );
  results.push(
    await expectDenied('guard delete denied', () =>
      deleteDoc(doc(uidDb('uid-guard'), 'users', 'uid-guard', 'syncMeta', 'reta-final-guard'))
    )
  );
  results.push(
    await expectDenied('intruder cannot overwrite snapshot', () =>
      setDoc(
        doc(intruderDb, 'users', 'uid-advance', 'snapshots', 'main'),
        envelope({ revision: 4, baseRevision: 3 })
      )
    )
  );

  report(results, { newRules, host: args.host, port: args.port });
  await environment.clearFirestore();
  await environment.cleanup();
}

function report(results, { newRules, host, port }) {
  const failures = results.filter((result) => !result.ok);
  for (const result of results) {
    console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.label}: ${result.detail}`);
  }
  console.log(`\nRULES_MODE=${newRules ? 'new' : 'legacy'} TARGET=${host}:${port}`);
  console.log(
    `RESULT ${failures.length === 0 ? 'PASS' : 'FAIL'} (${results.length - failures.length}/${results.length})`
  );
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
