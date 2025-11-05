import {
  Capabilities,
  Extension,
  defaultCapabilities as mlsDefaultCapabilities,
} from "ts-mls";
import { createMarmotGroupData } from "./marmot-group-data.js";
import { MARMOT_GROUP_DATA_EXTENSION_TYPE } from "./protocol.js";
import { createRequiredCapabilitiesExtension } from "./extensions.js";

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

/**
 * Extensions required for Marmot groups.
 *
 * According to MIP-01, groups MUST include:
 * - required_capabilities (mandating Marmot Group Data Extension)
 * - ratchet_tree
 * - marmot_group_data
 */
export const groupExtensions: Extension[] = [
  createRequiredCapabilitiesExtension(),
  {
    extensionType: "ratchet_tree",
    extensionData: new Uint8Array(),
  },
  {
    extensionType: MARMOT_GROUP_DATA_EXTENSION_TYPE,
    extensionData: createMarmotGroupData({
      nostrGroupId: new Uint8Array(32),
    }),
  },
];
