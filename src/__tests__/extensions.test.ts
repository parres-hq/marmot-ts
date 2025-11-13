import { describe, expect, it } from "vitest";
import { ensureLastResortExtension } from "../core/extensions";
import { LAST_RESORT_KEY_PACKAGE_EXTENSION_TYPE } from "../core/protocol";

describe("ensureLastResortExtension", () => {
  it("should add last resort extension when not present", () => {
    const extensions = [
      {
        extensionType: 1,
        extensionData: new Uint8Array([1, 2, 3]),
      },
    ];

    const result = ensureLastResortExtension(extensions);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(extensions[0]);
    expect(result[1]).toEqual({
      extensionType: LAST_RESORT_KEY_PACKAGE_EXTENSION_TYPE,
      extensionData: new Uint8Array(0),
    });
  });

  it("should not add last resort extension when already present", () => {
    const extensions = [
      {
        extensionType: 1,
        extensionData: new Uint8Array([1, 2, 3]),
      },
      {
        extensionType: LAST_RESORT_KEY_PACKAGE_EXTENSION_TYPE,
        extensionData: new Uint8Array(0),
      },
    ];

    const result = ensureLastResortExtension(extensions);

    expect(result).toHaveLength(2);
    expect(result).toEqual(extensions);
  });

  it("should handle empty extensions array", () => {
    const extensions = [];

    const result = ensureLastResortExtension(extensions);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      extensionType: LAST_RESORT_KEY_PACKAGE_EXTENSION_TYPE,
      extensionData: new Uint8Array(0),
    });
  });

  it("should preserve original array when last resort extension is present", () => {
    const extensions = [
      {
        extensionType: LAST_RESORT_KEY_PACKAGE_EXTENSION_TYPE,
        extensionData: new Uint8Array(0),
      },
      {
        extensionType: 2,
        extensionData: new Uint8Array([4, 5, 6]),
      },
    ];

    const result = ensureLastResortExtension(extensions);

    expect(result).toBe(extensions);
    expect(result).toHaveLength(2);
  });
});
