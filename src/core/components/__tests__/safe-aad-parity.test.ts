import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import {
  appDataDictionaryExtensionType,
  defaultCryptoProvider,
  getAppDataDictionary,
  getCiphersuiteImpl,
  type GroupContextExtension,
} from "ts-mls";
import { describe, expect, it } from "vitest";

import fixtureJson from "../../../__tests__/fixtures/safe-aad-rust.json";
import { createCredential } from "../../credential.js";
import { defaultCapabilities } from "../../default-capabilities.js";
import { generateKeyPackage } from "../../key-package.js";
import { isGreaseValue } from "../../grease.js";
import {
  componentEntry,
  getAppComponents,
  getComponentData,
  makeAppComponentsExtension,
} from "../dictionary.js";
import { SAFE_AAD_COMPONENT_ID } from "../ids.js";

type SafeAadFixture = {
  mdk_sha: string;
  source: string;
  extraction: "Engine::fresh_key_package -> KeyPackage::bytes -> MlsMessageIn -> LeafNode";
  dictionary_extension_hex: string;
  dictionary_sha256: string;
  safe_aad_hex: string;
  advertised_app_components: number[];
  capabilities: {
    advertised_extensions: number[];
    effective_extensions: number[];
    advertised_proposals: number[];
    effective_proposals: number[];
  };
};

const fixture = fixtureJson as SafeAadFixture;

function extensionBytes(extension: {
  extensionType: number;
  extensionData: Uint8Array;
}): Uint8Array {
  const bytes = new Uint8Array(4 + extension.extensionData.length);
  new DataView(bytes.buffer).setUint16(0, extension.extensionType);
  new DataView(bytes.buffer).setUint16(2, extension.extensionData.length);
  bytes.set(extension.extensionData, 4);
  return bytes;
}

describe("MDK SafeAAD parity", () => {
  it("matches the dictionary extracted from a genuine MDK KeyPackage", async () => {
    expect(fixture.mdk_sha).toBe(
      "dbf45c83a8e157302edd13010944ad2c6a9cf9a5",
    );
    expect(fixture.source).toContain("CgkaEngine::fresh_key_package");
    expect(fixture.extraction).toContain("KeyPackage::bytes");

    const ciphersuiteImpl = await getCiphersuiteImpl(
      "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519",
      defaultCryptoProvider,
    );
    const keyPackage = await generateKeyPackage({
      credential: createCredential(
        "884704bd421671e01c13f854d2ce23ce2a5bfe9562f4f297ad2bc921ba30c3a6",
      ),
      ciphersuiteImpl,
    });
    const extension = keyPackage.publicPackage.leafNode.extensions.find(
      (candidate) => candidate.extensionType === appDataDictionaryExtensionType,
    );
    expect(extension).toBeDefined();
    expect(bytesToHex(extensionBytes(extension!))).toBe(
      fixture.dictionary_extension_hex,
    );
    expect(
      getAppComponents(
        keyPackage.publicPackage.leafNode
          .extensions as GroupContextExtension[],
      ),
    ).toEqual(fixture.advertised_app_components);
    expect(
      bytesToHex(
        getComponentData(
          keyPackage.publicPackage.leafNode
            .extensions as GroupContextExtension[],
          SAFE_AAD_COMPONENT_ID,
        )!,
      ),
    ).toBe(fixture.safe_aad_hex);
  });

  it("keeps RFC defaults implicit in signed advertisements", () => {
    const capabilities = defaultCapabilities();
    const advertisedExtensions = capabilities.extensions.filter(
      (value) => !isGreaseValue(value),
    );
    const advertisedProposals = capabilities.proposals.filter(
      (value) => !isGreaseValue(value),
    );
    expect(advertisedExtensions).toEqual(
      fixture.capabilities.advertised_extensions,
    );
    expect(advertisedProposals).toEqual(
      fixture.capabilities.advertised_proposals,
    );
    expect(fixture.capabilities.effective_extensions).toEqual([1, 2, 3, 4, 5, 6]);
    expect(fixture.capabilities.effective_proposals).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
  });

  it("rejects SafeAAD as GroupContext state", () => {
    expect(() =>
      makeAppComponentsExtension([
        componentEntry(SAFE_AAD_COMPONENT_ID, hexToBytes(fixture.safe_aad_hex)),
      ]),
    ).toThrow(/SafeAAD.*LeafNode/i);
  });

  it("detects a one-byte dictionary mutation", () => {
    const encoded = hexToBytes(fixture.dictionary_extension_hex);
    encoded[encoded.length - 3] ^= 1;
    const mutated = {
      extensionType: appDataDictionaryExtensionType,
      extensionData: encoded.slice(4),
    } as GroupContextExtension;
    expect(() => getAppDataDictionary([mutated])).toThrow(
      /Could not decode app_data_dictionary/,
    );
    expect(bytesToHex(encoded)).not.toBe(fixture.dictionary_extension_hex);
  });
});
