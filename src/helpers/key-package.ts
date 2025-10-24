import { hexToBytes } from "@noble/ciphers/utils.js";
import { ExtensionType, KeyPackage, PrivateKeyPackage } from "ts-mls";
import { CiphersuiteId, ciphersuites } from "ts-mls/crypto/ciphersuite.js";
import { decodeKeyPackage } from "ts-mls/keyPackage.js";
import { getTagValue, NostrEvent } from "../lib/nostr.js";

/** Event kind for key package events */
export const KEY_PACKAGE_KIND = 443;

/** The name of the tag that contains the MLS protocol version */
export const KEY_PACKAGE_MLS_VERSION_TAG = "mls_protocol_version";

/** The name of the tag that contains the MLS cipher suite */
export const KEY_PACKAGE_CIPHER_SUITE_TAG = "mls_ciphersuite";

/** The name of the tag that contains the MLS extensions */
export const KEY_PACKAGE_EXTENSIONS_TAG = "mls_extensions";

/** The name of the tag that contains the relays */
export const KEY_PACKAGE_RELAYS_TAG = "relays";

/** The name of the tag that contains the client */
export const KEY_PACKAGE_CLIENT_TAG = "client";

/** The possible MLS protocol versions */
export type MLS_VERSIONS = "1.0";

/** Parsed client tag from a kind 443 event */
export type KeyPackageClient = {
  name: string;
  // TODO: this is probably a NIP-89 client tag, so it should probably have the rest of the fields
};

/**
 * A complete key package containing both public and private components.
 *
 * The public package can be shared with others to add this participant to groups,
 * while the private package must be kept secret and is used for decryption and signing.
 */
export type CompleteKeyPackage = {
  /** The public key package that can be shared with others */
  publicPackage: KeyPackage;
  /** The private key package that must be kept secret */
  privatePackage: PrivateKeyPackage;
};

/** Get the {@link KeyPackage} from a kind 443 event */
export function getKeyPackage(event: NostrEvent): KeyPackage {
  const content = hexToBytes(event.content);
  const decoded = decodeKeyPackage(content, 0);
  if (!decoded) throw new Error("Failed to decode key package");

  const [keyPackage, _noIdeaWhatThisIs] = decoded;
  return keyPackage;
}

/** Gets the MLS protocol version from a kind 443 event */
export function getKeyPackageMLSVersion(
  event: NostrEvent,
): MLS_VERSIONS | undefined {
  const version = getTagValue(event, KEY_PACKAGE_MLS_VERSION_TAG);
  return version as MLS_VERSIONS | undefined;
}

/** Gets the MLS cipher suite from a kind 443 event */
export function getKeyPackageCipherSuiteId(
  event: NostrEvent,
): CiphersuiteId | undefined {
  const cipherSuite = getTagValue(event, KEY_PACKAGE_CIPHER_SUITE_TAG);
  if (!cipherSuite) return undefined;

  // NOTE: we are intentially not passing a radix to parseInt here so that it can handle base 10 and 16 (with leading 0x)
  const id = parseInt(cipherSuite);

  // Verify that cipher suite is a valid ID
  if (!Object.values(ciphersuites).includes(id as CiphersuiteId))
    throw new Error(`Invalid MLS cipher suite ID ${id}`);

  // Cast number to CiphersuiteId
  return id as CiphersuiteId;
}

/** Gets the MLS extensions for a kind 443 event */
export function getKeyPackageExtensions(
  event: NostrEvent,
): ExtensionType[] | undefined {
  const tag = event.tags.find((t) => t[0] === KEY_PACKAGE_EXTENSIONS_TAG);
  if (!tag) return undefined;

  const ids = tag
    .slice(1)
    // NOTE: we are intentially not passing a radix to parseInt here so that it can handle base 10 and 16 (with leading 0x)
    .map((t) => parseInt(t))
    .filter((id) => Number.isFinite(id));

  return ids as ExtensionType[];
}

/** Gets the relays for a kind 443 event */
export function getKeyPackageRelays(event: NostrEvent): string[] | undefined {
  const tag = event.tags.find((t) => t[0] === KEY_PACKAGE_RELAYS_TAG);
  if (!tag) return undefined;
  return tag.slice(1);
}

/** Gets the client for a kind 443 event */
export function getKeyPackageClient(
  event: NostrEvent,
): KeyPackageClient | undefined {
  const tag = event.tags.find((t) => t[0] === KEY_PACKAGE_CLIENT_TAG);
  if (!tag) return undefined;

  // TODO: parse the rest of the client tag
  return {
    name: tag[1],
  };
}
