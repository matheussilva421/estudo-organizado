import { describe, expect, it, vi } from "vitest";
import { reconcileDerivedStateOnBoot } from "../../src/js/app/boot-reconciliation.js";

describe("reconcileDerivedStateOnBoot", () => {
  it("reconciles the Ciclo for an active non Reta Final plan", () => {
    const syncCiclo = vi.fn();
    const syncRetaFinal = vi.fn();
    const kind = reconcileDerivedStateOnBoot(
      { ativo: true, tipo: "ciclo" },
      { syncCiclo, syncRetaFinal }
    );
    expect(kind).toBe("ciclo");
    expect(syncCiclo).toHaveBeenCalledTimes(1);
    expect(syncRetaFinal).not.toHaveBeenCalled();
  });

  it("routes an active Reta Final plan to its own reconciliation", () => {
    const syncCiclo = vi.fn();
    const syncRetaFinal = vi.fn();
    const kind = reconcileDerivedStateOnBoot(
      { ativo: true, tipo: "reta_final" },
      { syncCiclo, syncRetaFinal }
    );
    expect(kind).toBe("reta-final");
    expect(syncRetaFinal).toHaveBeenCalledTimes(1);
    expect(syncCiclo).not.toHaveBeenCalled();
  });

  it("does nothing without an active plan", () => {
    const syncCiclo = vi.fn();
    const syncRetaFinal = vi.fn();
    const kind = reconcileDerivedStateOnBoot(
      { ativo: false },
      { syncCiclo, syncRetaFinal }
    );
    expect(kind).toBe("none");
    expect(syncCiclo).not.toHaveBeenCalled();
    expect(syncRetaFinal).not.toHaveBeenCalled();
  });

  it("reconciles the derived Ciclo once when a previous boot failed", () => {
    const syncCiclo = vi.fn();
    const syncRetaFinal = vi.fn();
    const kind = reconcileDerivedStateOnBoot(
      { ativo: true, tipo: "reta_final" },
      { syncCiclo, syncRetaFinal, recoveryPending: true }
    );
    expect(kind).toBe("recovery");
    expect(syncCiclo).toHaveBeenCalledTimes(1);
    expect(syncRetaFinal).not.toHaveBeenCalled();
  });

  it("tolerates a missing plan and missing callbacks", () => {
    expect(reconcileDerivedStateOnBoot(null, {})).toBe("none");
    expect(reconcileDerivedStateOnBoot({ ativo: true, tipo: "ciclo" }, {})).toBe(
      "ciclo"
    );
  });
});
