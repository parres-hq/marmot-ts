import { describe, expect, it } from "vitest";

import {
  DEFAULT_CONVERGENCE_POLICY,
  normalizeConvergencePolicy,
} from "../../core/convergence.js";
import {
  openConvergencePass,
  refreshConvergencePass,
} from "../types.js";

describe("bounded convergence scheduling", () => {
  it("defaults older policy input to the immutable v1 pass bound", () => {
    const { maxConvergencePassMs: _, ...legacy } = DEFAULT_CONVERGENCE_POLICY;
    expect(normalizeConvergencePolicy(legacy).maxConvergencePassMs).toBe(5_000);
  });

  it("samples one monotonic deadline and never moves it for later input", () => {
    const pass = openConvergencePass(100, 5_000, 7);
    expect(pass).toEqual({
      generation: 7,
      openedAtMs: 100,
      deadlineMs: 5_100,
      lastRelevantInputMs: 100,
    });
    expect(refreshConvergencePass(pass, 2_000)).toEqual({
      ...pass,
      lastRelevantInputMs: 2_000,
    });
    expect(refreshConvergencePass(pass, 2_000).deadlineMs).toBe(5_100);
  });

  it("treats the exact deadline as expired", () => {
    const pass = openConvergencePass(100, 5_000, 1);
    expect(pass.deadlineMs > 5_099).toBe(true);
    expect(pass.deadlineMs <= 5_100).toBe(true);
  });
});
