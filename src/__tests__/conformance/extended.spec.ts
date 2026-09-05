import { describe, expect, it } from "vitest";

import { IngestionPool } from "../../engine/ingestion-pool.js";

describe("deterministic offline catchup pressure", () => {
  const profiles = [
    { start: 6, size: 96 },
    { start: 12, size: 384 },
    { start: 18, size: 1_024 },
  ] as const;

  for (const profile of profiles) {
    for (let offset = 0; offset < 6; offset++) {
      const index = profile.start + offset;
      it(`offline-catchup-pressure/seed-42/case-${index}`, () => {
        const capacity = Math.max(1, Math.floor(profile.size / 2));
        let pool = new IngestionPool<{ id: string }>({ maxSize: capacity });
        const accepted: string[] = [];
        for (let n = 0; n < capacity; n++) {
          const id = `case-${index}-anchor-${n}`;
          expect(pool.add(id, { id }, n)).toEqual({ kind: "accepted" });
          accepted.push(id);
        }

        const retryId = `case-${index}-retry`;
        expect(pool.add(retryId, { id: retryId }, capacity)).toEqual({
          kind: "refused",
          reason: "capacity",
        });
        expect(pool.has(retryId)).toBe(false);

        // Restart-before-processing cases rebuild the in-memory subject from
        // the same durable input sequence; other recovery arms retain it.
        if (offset === 4) {
          const restarted = new IngestionPool<{ id: string }>({ maxSize: capacity });
          for (const [sourceEpoch, id] of accepted.entries())
            expect(restarted.add(id, { id }, sourceEpoch)).toEqual({ kind: "accepted" });
          pool = restarted;
        }

        const released = accepted[offset % accepted.length]!;
        pool.remove(released);
        expect(pool.add(retryId, { id: retryId }, capacity)).toEqual({ kind: "accepted" });
        expect(pool.entries().map((entry) => entry.id)).toContain(retryId);
        expect(pool.sourceEpochs()).toContain(capacity);
        expect(new Set(pool.entries().map((entry) => entry.id)).size).toBe(pool.size);
      });
    }
  }
});
