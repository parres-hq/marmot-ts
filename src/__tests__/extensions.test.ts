import {
  defaultCryptoProvider,
  defaultLifetime,
  generateKeyPackage,
  getCiphersuiteFromName,
  getCiphersuiteImpl,
} from "ts-mls";
import { describe, expect, it } from "vitest";
import { createCredential } from "../core/credential.js";
import { defaultCapabilities } from "../core/default-capabilities.js";
import {
  createKeyPackageEvent,
  getKeyPackageExtensions,
  keyPackageDefaultExtensions,
} from "../core/key-package.js";

describe("Key Package Extensions", () => {
  it("should include all required MLS extensions in key package", async () => {
    // Create a test key package with default extensions
    const pubkey =
      "884704bd421671e01c13f854d2ce23ce2a5bfe9562f4f297ad2bc921ba30c3a6";
    const credential = createCredential(pubkey);

    const ciphersuiteImpl = await getCiphersuiteImpl(
      getCiphersuiteFromName("MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519"),
      defaultCryptoProvider,
    );

    const keyPackage = await generateKeyPackage(
      credential,
      defaultCapabilities(),
      defaultLifetime,
      keyPackageDefaultExtensions(),
      ciphersuiteImpl,
    );

    // Create key package event
    const event = createKeyPackageEvent({
      keyPackage: keyPackage.publicPackage,
      pubkey,
      relays: ["wss://relay.example.com"],
      client: "test-client",
    });

    // Verify the event includes the mls_extensions tag
    const extensionsTag = event.tags.find((tag) => tag[0] === "mls_extensions");
    expect(extensionsTag).toBeDefined();
    expect(extensionsTag!.length).toBeGreaterThan(1);

    // Extract extension types from the tag
    const extensionTypes = extensionsTag!
      .slice(1)
      .map((ext) => parseInt(ext, 16));

    // Should only include marmot_group_data (0xf2ee) - default extensions (0x0001-0x0005) are NOT listed
    // Default extensions: application_id(0x0001), ratchet_tree(0x0002), required_capabilities(0x0003),
    // external_pub(0x0004), external_senders(0x0005) are implicitly supported by all MLS implementations
    expect(extensionTypes).not.toContain(0x0001); // application_id (default)
    expect(extensionTypes).not.toContain(0x0002); // ratchet_tree (default)
    expect(extensionTypes).not.toContain(0x0003); // required_capabilities (default)
    expect(extensionTypes).not.toContain(0x0004); // external_pub (default)
    expect(extensionTypes).not.toContain(0x0005); // external_senders (default)
    expect(extensionTypes).toContain(0xf2ee); // marmot_group_data (custom)

    // Verify we can parse the extensions back using getKeyPackageExtensions
    const parsedExtensions = getKeyPackageExtensions(event as any);
    expect(parsedExtensions).toBeDefined();
    expect(parsedExtensions!.length).toBe(1); // Only marmot_group_data should be listed
    expect(parsedExtensions).not.toContain(0x0003);
    expect(parsedExtensions).not.toContain(0x0002);
    expect(parsedExtensions).toContain(0xf2ee);
  });

  it("should correctly map string extension types to numeric values", async () => {
    const pubkey =
      "884704bd421671e01c13f854d2ce23ce2a5bfe9562f4f297ad2bc921ba30c3a6";
    const credential = createCredential(pubkey);

    const ciphersuiteImpl = await getCiphersuiteImpl(
      getCiphersuiteFromName("MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519"),
      defaultCryptoProvider,
    );

    const keyPackage = await generateKeyPackage(
      credential,
      defaultCapabilities(),
      defaultLifetime,
      keyPackageDefaultExtensions(),
      ciphersuiteImpl,
    );

    // Create key package event
    const event = createKeyPackageEvent({
      keyPackage: keyPackage.publicPackage,
      pubkey,
      relays: ["wss://relay.example.com"],
    });

    // Verify the extensions tag contains the correct hex values
    const extensionsTag = event.tags.find((tag) => tag[0] === "mls_extensions");
    expect(extensionsTag).toBeDefined();

    const extensionHexValues = extensionsTag!.slice(1);
    // Should only include marmot_group_data - default extensions are NOT listed
    expect(extensionHexValues).not.toContain("0x0001"); // application_id (default)
    expect(extensionHexValues).not.toContain("0x0002"); // ratchet_tree (default)
    expect(extensionHexValues).not.toContain("0x0003"); // required_capabilities (default)
    expect(extensionHexValues).not.toContain("0x0004"); // external_pub (default)
    expect(extensionHexValues).not.toContain("0x0005"); // external_senders (default)
    expect(extensionHexValues).toContain("0xf2ee"); // marmot_group_data (custom)
  });
});
