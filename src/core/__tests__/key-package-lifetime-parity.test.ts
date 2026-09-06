import { bytesToHex } from "@noble/hashes/utils.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import fixture from "../../__tests__/fixtures/key-package-lifetime-rust.json";
import {
  createDefaultKeyPackageLifetime,
  isLifetimeCurrentWithGrace,
  isLifetimeWithinCap,
} from "../../utils/timestamp.js";

type Boundary = {
  not_before: number;
  not_after: number;
  accepted: boolean;
};

type LifetimeFixture = {
  mdk_sha: string;
  projection_version: number;
  validation_time: number;
  lifetime: {
    not_before: number;
    not_after: number;
    serialized_hex: string;
    projection_sha256: string;
  };
  capabilities: {
    advertised_extensions: number[];
    effective_extensions: number[];
    advertised_proposals: number[];
    effective_proposals: number[];
    advertised_app_components: number[];
  };
  boundaries: Record<"accepted_cap" | "one_over" | "expired" | "not_yet_current", Boundary>;
};

function encodeUint64(value: bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, value);
  return bytes;
}

function serializeLifetime(notBefore: bigint, notAfter: bigint): Uint8Array {
  const bytes = new Uint8Array(16);
  bytes.set(encodeUint64(notBefore), 0);
  bytes.set(encodeUint64(notAfter), 8);
  return bytes;
}

describe("MDK KeyPackage lifetime parity", () => {
  const rust = fixture as LifetimeFixture;

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("matches fixed Lifetime bytes and the accepted range boundary", () => {
    expect(rust.mdk_sha).toBe("dbf45c83a8e157302edd13010944ad2c6a9cf9a5");
    expect(rust.projection_version).toBe(1);
    expect(
      bytesToHex(
        serializeLifetime(
          BigInt(rust.lifetime.not_before),
          BigInt(rust.lifetime.not_after),
        ),
      ),
    ).toBe(rust.lifetime.serialized_hex);

    expect(
      isLifetimeWithinCap({
        notBefore: BigInt(rust.boundaries.accepted_cap.not_before),
        notAfter: BigInt(rust.boundaries.accepted_cap.not_after),
      }),
    ).toBe(rust.boundaries.accepted_cap.accepted);
    expect(
      isLifetimeWithinCap({
        notBefore: BigInt(rust.boundaries.one_over.not_before),
        notAfter: BigInt(rust.boundaries.one_over.not_after),
      }),
    ).toBe(rust.boundaries.one_over.accepted);
  });

  it("matches expired and not-yet-current outcomes at the fixed clock", () => {
    vi.setSystemTime(rust.validation_time * 1000);
    for (const name of ["expired", "not_yet_current"] as const) {
      const boundary = rust.boundaries[name];
      expect(
        isLifetimeCurrentWithGrace({
          notBefore: BigInt(boundary.not_before),
          notAfter: BigInt(boundary.not_after),
        }),
      ).toBe(boundary.accepted);
    }
  });

  it("keeps produced defaults below the accepted maximum", () => {
    vi.setSystemTime(rust.validation_time * 1000);
    const produced = createDefaultKeyPackageLifetime();
    expect(produced.notAfter - produced.notBefore).toBe(7_257_600n);
    expect(produced.notAfter - produced.notBefore).not.toBe(7_261_200n);
  });

  it("distinguishes signed advertisements from implicit RFC support", () => {
    expect(rust.capabilities.advertised_extensions).not.toContain(1);
    expect(rust.capabilities.effective_extensions).toEqual(
      expect.arrayContaining([1, 2, 3, 4, 5]),
    );
    expect(rust.capabilities.advertised_proposals).not.toContain(1);
    expect(rust.capabilities.effective_proposals).toEqual(
      expect.arrayContaining([1, 2, 3, 4, 5, 6, 7]),
    );
    expect(rust.capabilities.advertised_app_components).toEqual(
      expect.arrayContaining([0x0001, 0x0002, 0x000b, 0x8009]),
    );
  });

  it("negative control detects a one-second cap mutation", () => {
    const mutated = {
      notBefore: BigInt(rust.boundaries.accepted_cap.not_before),
      notAfter: BigInt(rust.boundaries.accepted_cap.not_after) + 1n,
    };
    expect(isLifetimeWithinCap(mutated)).toBe(false);
  });
});
