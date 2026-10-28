export type ServiceWorkerState = 'UNSUPPORTED' | 'REGISTERED' | 'IDLE';

export async function registerV2ServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    return null;
  }
}

export async function updateServiceWorkerWithoutReload(
  registration: ServiceWorkerRegistration,
): Promise<ServiceWorkerState> {
  await registration.update();
  if (registration.waiting) return 'IDLE';
  if (registration.active) return 'REGISTERED';
  return 'IDLE';
}
