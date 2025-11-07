import { Extension } from "ts-mls";
import { MARMOT_GROUP_DATA_EXTENSION_TYPE } from "./protocol.js";

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
