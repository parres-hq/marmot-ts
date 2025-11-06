import {
  Capabilities,
  defaultCapabilities as mlsDefaultCapabilities,
} from "ts-mls";
import { MARMOT_GROUP_DATA_EXTENSION_TYPE } from "./protocol.js";

/**
 * Default capabilities for Marmot key packages.
 *
 * According to MIP-01, key packages MUST signal support for the Marmot Group Data Extension
 * and ratchet_tree in their capabilities to pass validation when being added to groups.
 */
export function defaultCapabilities(): Capabilities {
  const capabilities = mlsDefaultCapabilities();

  // Add Marmot Group Data Extension to capabilities
  // Note: ratchet_tree is already included in mlsDefaultCapabilities()
  capabilities.extensions = [
    ...capabilities.extensions,
    MARMOT_GROUP_DATA_EXTENSION_TYPE,
  ];

  return capabilities;
}
