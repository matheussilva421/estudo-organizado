import { describe, expect, it } from "vitest";
import {
  BOOT_DERIVED_RECOVERY_KEY,
  consumeDerivedRecoveryPending,
  markDerivedRecoveryPending,
} from "../../src/js/store/boot-recovery.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

describe("boot derived recovery marker", () => {
  it("marks and consumes the pending reconciliation exactly once", () => {
    const storage = memoryStorage();
    expect(markDerivedRecoveryPending(storage)).toBe(true);
    expect(storage.getItem(BOOT_DERIVED_RECOVERY_KEY)).toBe("1");
    expect(consumeDerivedRecoveryPending(storage)).toBe(true);
    expect(consumeDerivedRecoveryPending(storage)).toBe(false);
    expect(storage.getItem(BOOT_DERIVED_RECOVERY_KEY)).toBeNull();
  });

  it("never throws when storage is unavailable or broken", () => {
    expect(markDerivedRecoveryPending(null)).toBe(false);
    expect(consumeDerivedRecoveryPending(null)).toBe(false);
    const broken = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
      removeItem() {
        throw new Error("blocked");
      },
    };
    expect(markDerivedRecoveryPending(broken)).toBe(false);
    expect(consumeDerivedRecoveryPending(broken)).toBe(false);
  });
});
