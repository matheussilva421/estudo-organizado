import { describe, expect, it } from 'vitest';
import {
  resolveV2RemoteConfig,
  V1_FIREBASE_PROJECT_ID,
  V2_EMULATOR_PROJECT_ID,
} from '../../src/platform/firebase/config';

const emulatorEnv = {
  VITE_V2_REMOTE_ENABLED: 'true',
  VITE_V2_FIREBASE_PROJECT_ID: V2_EMULATOR_PROJECT_ID,
  VITE_V2_FIREBASE_AUTH_DOMAIN: 'demo-estudo-v2.firebaseapp.com',
  VITE_V2_FIREBASE_APP_ID: '1:123456789:web:demo',
  VITE_V2_FIRESTORE_EMULATOR_HOST: '127.0.0.1',
  VITE_V2_FIRESTORE_EMULATOR_PORT: '8080',
  VITE_V2_AUTH_EMULATOR_URL: 'http://127.0.0.1:9099',
};

describe('F7 environment boundary', () => {
  it('f7_defaults_to_local_only_without_config', () => {
    expect(resolveV2RemoteConfig({})).toBeNull();
  });

  it('f7_requires_an_explicit_remote_flag', () => {
    expect(resolveV2RemoteConfig({ ...emulatorEnv, VITE_V2_REMOTE_ENABLED: 'false' })).toBeNull();
  });

  it('f7_rejects_unapproved_project_or_origin', () => {
    expect(
      resolveV2RemoteConfig({
        ...emulatorEnv,
        VITE_V2_FIREBASE_PROJECT_ID: V1_FIREBASE_PROJECT_ID,
      }),
    ).toBeNull();
    expect(
      resolveV2RemoteConfig({
        ...emulatorEnv,
        VITE_V2_FIREBASE_AUTH_DOMAIN: 'app-de-estudos-14564.firebaseapp.com',
      }),
    ).toBeNull();
    expect(
      resolveV2RemoteConfig({
        VITE_V2_REMOTE_ENABLED: 'true',
        VITE_V2_FIREBASE_PROJECT_ID: 'outro-projeto',
        VITE_V2_FIREBASE_AUTH_DOMAIN: 'outro-projeto.firebaseapp.com',
        VITE_V2_FIREBASE_APP_ID: '1:1:web:outro',
        VITE_V2_APPROVED_PROJECT_ID: 'outro-projeto',
      }),
    ).toBeNull();
  });

  it('f7_emulator_config_is_explicit', () => {
    expect(resolveV2RemoteConfig(emulatorEnv)).toEqual({
      projectId: V2_EMULATOR_PROJECT_ID,
      authDomain: 'demo-estudo-v2.firebaseapp.com',
      appId: '1:123456789:web:demo',
      apiKey: 'demo-api-key',
      firestoreEmulator: { host: '127.0.0.1', port: 8080 },
      authEmulator: { url: 'http://127.0.0.1:9099' },
    });
    expect(
      resolveV2RemoteConfig({
        ...emulatorEnv,
        VITE_V2_FIRESTORE_EMULATOR_HOST: '10.0.0.5',
      }),
    ).toBeNull();
    expect(
      resolveV2RemoteConfig({
        ...emulatorEnv,
        VITE_V2_AUTH_EMULATOR_URL: '',
      }),
    ).toBeNull();
  });

  it('f7_redirect_auth_mode_is_explicit_and_rejects_typos', () => {
    expect(
      resolveV2RemoteConfig({
        ...emulatorEnv,
        VITE_V2_GOOGLE_AUTH_MODE: 'redirect',
      }),
    ).toMatchObject({ authMode: 'redirect' });
    expect(
      resolveV2RemoteConfig({
        ...emulatorEnv,
        VITE_V2_GOOGLE_AUTH_MODE: 'redirct',
      }),
    ).toBeNull();
    expect(resolveV2RemoteConfig(emulatorEnv)).not.toHaveProperty('authMode');
  });

  it('f7_does_not_share_v1_origin_or_database', () => {
    expect(
      resolveV2RemoteConfig({
        ...emulatorEnv,
        VITE_V2_FIREBASE_AUTH_DOMAIN: 'estudo-organizado.matheussilva421.workers.dev',
      }),
    ).toBeNull();
    expect(V2_EMULATOR_PROJECT_ID).not.toBe(V1_FIREBASE_PROJECT_ID);
  });
});
