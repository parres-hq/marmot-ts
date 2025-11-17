import { CiphersuiteImpl, Extension } from "ts-mls";
import { ClientState } from "ts-mls/clientState.js";
import { KeyPackage } from "ts-mls/keyPackage.js";
import { MarmotGroupData } from "./protocol.js";
import { CompleteKeyPackage } from "./key-package-store.js";

/**
 * Complete group package containing both MLS state and Marmot metadata.
 *
 * Similar to CompleteKeyPackage, this stores both the MLS ClientState
 * (for cryptographic operations) and Marmot-specific metadata (for UI/Nostr).
 */
export interface CompleteGroup {
  /** The MLS client state for cryptographic operations */
  clientState: ClientState;
  /** Marmot-specific group metadata */
  marmotGroupData: MarmotGroupData;
}

/**
 * Represents an MLS group with Marmot-specific extensions and state management.
 *
 * This interface provides the core structure for managing MLS groups with
 * Marmot Group Data Extension integration.
 */
export interface Group {
  /** 32-byte private MLS group identifier (never published to Nostr) */
  groupId: Uint8Array;
  /** Current epoch number (starts at 0 for new groups) */
  epoch: number;
  /** Array of group members with their key packages */
  members: Member[];
  /** Group context extensions including Marmot Group Data Extension */
  extensions: Extension[];
  /** Marmot-specific group metadata */
  marmotGroupData: MarmotGroupData;
  /** Ratchet tree representing the current group state */
  ratchetTree: Uint8Array;
  /** Confirmed transcript hash for the current epoch */
  confirmedTranscriptHash: Uint8Array;
  /** Interim transcript hash for pending commits */
  interimTranscriptHash: Uint8Array;
}

/**
 * Represents a member in an MLS group.
 */
export interface Member {
  /** The member's key package */
  keyPackage: KeyPackage;
  /** Index in the ratchet tree */
  index: number;
  /** Whether this member is the group creator */
  isCreator: boolean;
}

/**
 * Parameters for creating a new MLS group.
 */
export interface CreateGroupParams {
  /** Creator's complete key package (public + private) */
  creatorKeyPackage: CompleteKeyPackage;
  /** Marmot Group Data configuration */
  marmotGroupData: MarmotGroupData;
  /** Additional group context extensions (optional) */
  extensions?: Extension[];
  /** Cipher suite implementation for cryptographic operations */
  ciphersuiteImpl: CiphersuiteImpl;
}

/**
 * Result of a successful group creation operation.
 */
export interface CreateGroupResult {
  /** The complete group package (ClientState + metadata) */
  completeGroup: CompleteGroup;
  /** The created group with initial state (for display/UI) */
  group: Group;
  /** Welcome message for adding initial members (empty for creator-only group) */
  welcomeMessage: Uint8Array;
  /** Initial commit message for group creation */
  commitMessage: Uint8Array;
}

// Re-export types from ts-mls for convenience
export type { CompleteKeyPackage } from "./key-package-store.js";
export type { CiphersuiteImpl } from "ts-mls/crypto/ciphersuite.js";
export type { ClientState } from "ts-mls/clientState.js";
