import { describe, expect, it } from "vitest";
import { selectRetaFinalImportEntries } from "../../src/js/views/reta-final-import.js";

function comparison() {
  return {
    entries: [
      { kind: "CREATE", command: { operationId: "op-create" } },
      { kind: "UPDATE", command: { operationId: "op-update" } },
      {
        kind: "ARCHIVE_CANDIDATE",
        command: { type: "ARCHIVE", blockIds: ["rf-3"] },
      },
      { kind: "CONFLICT" },
      { kind: "UNCHANGED" },
    ],
  };
}

describe("selectRetaFinalImportEntries", () => {
  it("includes only checked actionable entries", () => {
    const result = selectRetaFinalImportEntries(comparison(), [1], []);
    expect(result.actionable.map((item) => item.index)).toEqual([1]);
    expect(result.archives).toEqual([]);
  });

  it("keeps archive candidates opt-in", () => {
    const result = selectRetaFinalImportEntries(comparison(), [0], [2]);
    expect(result.actionable.map((item) => item.index)).toEqual([0]);
    expect(result.archives.map((item) => item.index)).toEqual([2]);
  });

  it("ignores conflicts and unselected entries", () => {
    const result = selectRetaFinalImportEntries(comparison(), [], []);
    expect(result.actionable).toEqual([]);
    expect(result.archives).toEqual([]);
  });
});
