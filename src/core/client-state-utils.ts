import { ClientState } from "ts-mls/clientState.js";
import { Extension } from "ts-mls";
import {
  MarmotGroupData,
  MARMOT_GROUP_DATA_EXTENSION_TYPE,
} from "./protocol.js";
import { decodeMarmotGroupData } from "./marmot-group-data.js";
import { bytesToHex } from "@noble/hashes/utils.js";

/**
 * Extracts MarmotGroupData from a ClientState's extensions.
 *
 * @param clientState - The ClientState to extract data from
 * @returns The MarmotGroupData if found, null otherwise
 */
export function extractMarmotGroupData(
  clientState: ClientState,
): MarmotGroupData | null {
  const marmotExtension = clientState.groupContext.extensions.find(
    (ext: Extension) =>
      typeof ext.extensionType === "number" &&
      ext.extensionType === MARMOT_GROUP_DATA_EXTENSION_TYPE,
  );

  if (!marmotExtension) {
    return null;
  }

  return decodeMarmotGroupData(marmotExtension.extensionData);
}

/**
 * Gets the group ID from ClientState as a hex string.
 *
 * @param clientState - The ClientState to get group ID from
 * @returns Hex string representation of the group ID
 */
export function getGroupIdHex(clientState: ClientState): string {
  return bytesToHex(clientState.groupContext.groupId);
}

/**
 * Gets the Nostr group ID from ClientState as a hex string.
 *
 * @param clientState - The ClientState to get Nostr group ID from
 * @returns Hex string representation of the Nostr group ID
 */
export function getNostrGroupIdHex(clientState: ClientState): string {
  const marmotData = extractMarmotGroupData(clientState);
  if (!marmotData) {
    throw new Error("MarmotGroupData not found in ClientState");
  }
  return bytesToHex(marmotData.nostrGroupId);
}

/**
 * Gets the current epoch from ClientState.
 *
 * @param clientState - The ClientState to get epoch from
 * @returns The current epoch number
 */
export function getEpoch(clientState: ClientState): number {
  return Number(clientState.groupContext.epoch);
}

/**
 * Gets the member count from ClientState.
 *
 * @param clientState - The ClientState to get member count from
 * @returns The number of members in the group
 */
export function getMemberCount(clientState: ClientState): number {
  return clientState.ratchetTree.filter(
    (node) => node && node.nodeType === "leaf",
  ).length;
}
