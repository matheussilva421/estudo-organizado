/**
 * Marcador durável de recuperação de boot.
 *
 * Quando a migração falha, o estado anterior é restaurado e a reconciliação
 * derivada (Ciclo/Reta Final) não chega a rodar. O marcador garante uma única
 * reconciliação no próximo boot bem-sucedido, sem alterar o boot normal.
 */

export const BOOT_DERIVED_RECOVERY_KEY = "estudo_boot_derived_recovery";

function storageOf(storage) {
  if (storage !== undefined) return storage;
  return typeof globalThis.localStorage !== "undefined"
    ? globalThis.localStorage
    : null;
}

export function markDerivedRecoveryPending(storage) {
  try {
    const target = storageOf(storage);
    if (!target) return false;
    target.setItem(BOOT_DERIVED_RECOVERY_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

export function consumeDerivedRecoveryPending(storage) {
  try {
    const target = storageOf(storage);
    if (!target) return false;
    const pending = target.getItem(BOOT_DERIVED_RECOVERY_KEY) === "1";
    if (pending) target.removeItem(BOOT_DERIVED_RECOVERY_KEY);
    return pending;
  } catch {
    return false;
  }
}
