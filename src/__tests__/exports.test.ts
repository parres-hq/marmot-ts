import { describe, expect, it } from "vitest";
import * as exports from "../index.js";

describe("exports", () => {
  it("should export the expected members", () => {
    expect(Object.keys(exports).sort()).toMatchInlineSnapshot(`
      [
        "KEY_PACKAGE_CIPHER_SUITE_TAG",
        "KEY_PACKAGE_CLIENT_TAG",
        "KEY_PACKAGE_EXTENSIONS_TAG",
        "KEY_PACKAGE_KIND",
        "KEY_PACKAGE_MLS_VERSION_TAG",
        "KEY_PACKAGE_RELAYS_TAG",
        "Marmot",
        "ciphersuite",
        "createCredential",
        "defaultExtensions",
        "getKeyPackage",
        "getKeyPackageCipherSuiteId",
        "getKeyPackageClient",
        "getKeyPackageExtensions",
        "getKeyPackageMLSVersion",
        "getKeyPackageRelays",
      ]
    `);
  });
});
