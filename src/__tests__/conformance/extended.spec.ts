import { describe, expect, it } from "vitest";

import { IngestionPool } from "../../engine/ingestion-pool.js";

describe("deterministic offline catchup pressure", () => {
  it("refuses capacity without terminally consuming the input", () => {
    const pool = new IngestionPool<{ id: string }>({ maxSize: 1 });
    expect(pool.add("anchor", { id: "anchor" }, 1)).toEqual({ kind: "accepted" });
    expect(pool.add("retry", { id: "retry" }, 2)).toEqual({ kind: "accepted" });
  });
});
