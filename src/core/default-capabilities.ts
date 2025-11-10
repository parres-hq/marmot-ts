import {
  Capabilities,
  defaultCapabilities as mlsDefaultCapabilities,
} from "ts-mls";
import {
  CiphersuiteId,
  getCiphersuiteNameFromId,
} from "ts-mls/crypto/ciphersuite.js";
import { MARMOT_GROUP_DATA_EXTENSION_TYPE } from "./protocol.js";

/**
 * Default capabilities for Marmot key packages.
 *
 * According to MIP-01, key packages MUST signal support for the Marmot Group Data Extension
 * and ratchet_tree in their capabilities to pass validation when being added to groups.
 */
export function defaultCapabilities(
  cipherSuite: CiphersuiteId = 1,
): Capabilities {
  const capabilities = mlsDefaultCapabilities();

  // Add Marmot Group Data Extension to capabilities
  capabilities.extensions = [
    ...capabilities.extensions,
    MARMOT_GROUP_DATA_EXTENSION_TYPE,
  ];

  // Convert cipher suite ID to name and replace the ciphersuites array with only the selected one
  capabilities.ciphersuites = [getCiphersuiteNameFromId(cipherSuite)];

  // Only include "basic" credential type (remove "x509" since we don't support it)
  // Grease values are automatically added and should be kept
  capabilities.credentials = ["basic"];

  return capabilities;
}
