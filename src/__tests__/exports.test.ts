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
        "KEY_PACKAGE_RELAY_LIST_KIND",
        "KEY_PACKAGE_RELAY_LIST_RELAY_TAG",
        "KeyPackageStore",
        "MARMOT_GROUP_DATA_EXTENSION_TYPE",
        "MARMOT_GROUP_DATA_VERSION",
        "Marmot",
        "ciphersuite",
        "createCredential",
        "createKeyPackageEvent",
        "createMarmotGroupData",
        "createRequiredCapabilitiesExtension",
        "decodeMarmotGroupData",
        "defaultCapabilities",
        "encodeMarmotGroupData",
        "extendedExtensionTypes",
        "getCredentialPubkey",
        "getKeyPackage",
        "getKeyPackageCipherSuiteId",
        "getKeyPackageClient",
        "getKeyPackageExtensions",
        "getKeyPackageMLSVersion",
        "getKeyPackageRelayList",
        "getKeyPackageRelays",
        "getTagValue",
        "isAdmin",
        "isHexKey",
        "isValidKeyPackageRelayListEvent",
        "isValidRelayUrl",
        "keyPackageDefaultExtensions",
        "normalizeRelayUrl",
        "supportsMarmotExtensions",
      ]
    `);
  });
});
