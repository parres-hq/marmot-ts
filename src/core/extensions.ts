import {
  encodeRequiredCapabilities,
  Extension,
  RequiredCapabilities,
} from "ts-mls";
import { MARMOT_GROUP_DATA_EXTENSION_TYPE } from "./protocol.js";

/**
 * Creates required capabilities extension that mandates the Marmot Group Data Extension and ratchet_tree.
 *
 * According to MIP-01, all groups MUST require the Marmot Group Data Extension and ratchet_tree.
 */
export function createRequiredCapabilitiesExtension(): Extension {
  const requiredCapabilities: RequiredCapabilities = {
    extensionTypes: [
      MARMOT_GROUP_DATA_EXTENSION_TYPE,
      // TODO: disabled ratchet_tree for now because its not clear if it should be requiring the "default extensions"
      // see www.rfc-editor.org/rfc/rfc9420.html#section-7.2-4
      // defaultExtensionTypes.ratchet_tree,
    ],
    proposalTypes: [],
    credentialTypes: ["basic"],
  };

  return {
    extensionType: "required_capabilities",
    extensionData: encodeRequiredCapabilities(requiredCapabilities),
  };
}

/**
 * Validates that a key package supports the required Marmot extensions.
 *
 * @param extensions - The extensions from a key package
 * @returns true if the Marmot Group Data Extension is supported
 */
export function supportsMarmotExtensions(extensions: Extension[]): boolean {
  return extensions.some(
    (ext) =>
      typeof ext.extensionType === "number" &&
      ext.extensionType === MARMOT_GROUP_DATA_EXTENSION_TYPE,
  );
}
