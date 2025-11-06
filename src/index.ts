import {
  acceptAll,
  Ciphersuite,
  CiphersuiteImpl,
  ClientState,
  createApplicationMessage,
  createCommit,
  CreateCommitResult,
  createGroup,
  Credential,
  CryptoProvider,
  defaultCryptoProvider,
  defaultLifetime,
  emptyPskIndex,
  generateKeyPackage,
  getCiphersuiteFromName,
  getCiphersuiteImpl,
  joinGroup,
  makePskIndex,
  MlsPrivateMessage,
  MlsPublicMessage,
  PrivateMessage,
  processMessage,
  ProcessMessageResult,
  processPrivateMessage,
  Proposal,
  RatchetTree,
  Welcome,
} from "ts-mls";
import { createCredential } from "./core/credential.js";
import { defaultCapabilities } from "./core/default-capabilities.js";
import { CompleteKeyPackage } from "./core/key-package-store.js";
import { keyPackageDefaultExtensions } from "./core/key-package.js";

// export all helpers
export * from "./core/index.js";
export * from "./utils/index.js";

export const ciphersuite: Ciphersuite = getCiphersuiteFromName(
  "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519",
);

/**
 * Main class providing MLS (Messaging Layer Security) functionality for the Marmot protocol.
 *
 * This class wraps the ts-mls library to provide a simplified interface for:
 * - Creating and managing MLS groups
 * - Secure message exchange with forward secrecy
 * - Adding and removing group members
 * - Processing incoming messages and commits
 *
 * @example
 * ```typescript
 * const marmot = new Marmot()
 * const credential = marmot.createCredential("user_public_key")
 * const keyPackage = await marmot.createKeyPackage(credential)
 * const group = await marmot.createGroup(keyPackage)
 * ```
 */
export class Marmot {
  private ciphersuiteImpl: Promise<CiphersuiteImpl>;

  /**
   * Creates a new Marmot instance.
   *
   * @param provider - Optional crypto provider. Defaults to the default crypto provider from ts-mls.
   */
  constructor(readonly provider: CryptoProvider = defaultCryptoProvider) {
    this.ciphersuiteImpl = getCiphersuiteImpl(ciphersuite, provider);
  }

  /**
   * Creates a basic credential from a public key.
   *
   * @param hexPublicKey - The public key as a hex string to use as the identity
   * @returns A basic credential that can be used to create key packages
   *
   * @example
   * ```typescript
   * const credential = marmot.createCredential("deadbeef123456")
   * ```
   */
  createCredential(hexPublicKey: string): Credential {
    return createCredential(hexPublicKey);
  }

  /**
   * Generates a key package for the given credential.
   *
   * A key package contains both public and private components needed for MLS operations.
   * The public part can be shared with others to add this participant to groups.
   *
   * @param credential - The credential to create a key package for
   * @returns A promise that resolves to a complete key package with both public and private components
   *
   * @example
   * ```typescript
   * const credential = marmot.createCredential("user_key")
   * const keyPackage = await marmot.createKeyPackage(credential)
   * ```
   */
  async createKeyPackage(credential: Credential): Promise<CompleteKeyPackage> {
    return generateKeyPackage(
      credential,
      defaultCapabilities(),
      defaultLifetime,
      keyPackageDefaultExtensions(),
      await this.ciphersuiteImpl,
    );
  }

  /**
   * Creates a new MLS group with the given key package as the initial member.
   *
   * @param keyPackage - The complete key package of the group creator
   * @param groupId - Optional custom group ID. If not provided, a random one will be generated
   * @returns A promise that resolves to the initial group state
   *
   * @example
   * ```typescript
   * const group = await marmot.createGroup(keyPackage)
   * // Or with custom group ID:
   * const customId = new Uint8Array(32).fill(42)
   * const group = await marmot.createGroup(keyPackage, customId)
   * ```
   */
  async createGroup(
    keyPackage: CompleteKeyPackage,
    groupId?: Uint8Array,
  ): Promise<ClientState> {
    const ciphersuiteImpl = await this.ciphersuiteImpl;
    const actualGroupId = groupId || ciphersuiteImpl.rng.randomBytes(32);

    return createGroup(
      actualGroupId,
      keyPackage.publicPackage,
      keyPackage.privatePackage,
      keyPackageDefaultExtensions(),
      ciphersuiteImpl,
    );
  }

  /**
   * Creates a commit with the given proposals (e.g., adding or removing members).
   *
   * Commits are used to make changes to the group state, such as adding new members,
   * removing existing members, or updating keys. All group members must process
   * the commit to stay synchronized.
   *
   * @param groupState - The current group state
   * @param proposals - Array of proposals to include in the commit (e.g., add/remove member proposals)
   * @returns A promise that resolves to the commit result including the new state and welcome message
   *
   * @example
   * ```typescript
   * const addProposal = {
   *   proposalType: "add" as const,
   *   add: { keyPackage: newMemberKeyPackage.publicPackage }
   * }
   * const result = await marmot.createCommit(groupState, [addProposal])
   * ```
   */
  async createCommit(
    groupState: ClientState,
    proposals: Proposal[],
  ): Promise<CreateCommitResult> {
    return createCommit(
      { state: groupState, cipherSuite: await this.ciphersuiteImpl },
      { extraProposals: proposals },
    );
  }

  /**
   * Creates an encrypted application message for the group.
   *
   * Messages are encrypted using the group's current encryption keys and provide
   * forward secrecy - even if future keys are compromised, past messages remain secure.
   *
   * @param groupState - The current group state
   * @param message - The plaintext message to encrypt
   * @returns A promise that resolves to the encrypted message and updated group state
   *
   * @example
   * ```typescript
   * const result = await marmot.createMessage(groupState, "Hello, group!")
   * const encodedMessage = {
   *   privateMessage: result.privateMessage,
   *   wireformat: "mls_private_message" as const,
   *   version: "mls10" as const
   * }
   * ```
   */
  async createMessage(
    groupState: ClientState,
    message: string,
  ): Promise<{
    newState: ClientState;
    privateMessage: PrivateMessage;
  }> {
    return createApplicationMessage(
      groupState,
      new TextEncoder().encode(message),
      await this.ciphersuiteImpl,
    );
  }

  /**
   * Processes an incoming message (either private application message or public commit).
   *
   * This method handles both:
   * - Private messages: Decrypts application messages and returns the plaintext
   * - Public messages: Processes commits and updates group state
   *
   * @param groupState - The current group state
   * @param message - The incoming MLS message (private or public)
   * @returns A promise that resolves to the processing result with updated state and/or decrypted message
   *
   * @example
   * ```typescript
   * const result = await marmot.processMessage(groupState, incomingMessage)
   * if (result.kind !== "newState") {
   *   const plaintext = new TextDecoder().decode(result.message)
   *   console.log("Received:", plaintext)
   * }
   * ```
   */
  async processMessage(
    groupState: ClientState,
    message: MlsPrivateMessage | MlsPublicMessage,
  ): Promise<ProcessMessageResult> {
    if ("privateMessage" in message) {
      // Handle private message
      return processPrivateMessage(
        groupState,
        message.privateMessage,
        emptyPskIndex,
        await this.ciphersuiteImpl,
      );
    } else {
      // Handle public message - use the general processMessage
      return processMessage(
        message,
        groupState,
        makePskIndex(groupState, {}),
        acceptAll,
        await this.ciphersuiteImpl,
      );
    }
  }

  /**
   * Joins an existing group using a welcome message.
   *
   * When a new member is added to a group, they receive a welcome message
   * that allows them to join and synchronize with the current group state.
   *
   * @param welcome - The welcome message received from the group
   * @param keyPackage - The complete key package of the joining member
   * @param ratchetTree - The current ratchet tree state from the group
   * @returns A promise that resolves to the new member's group state
   *
   * @example
   * ```typescript
   * // After receiving a welcome message from being added to a group:
   * const groupState = await marmot.joinGroup(
   *   welcomeMessage,
   *   myKeyPackage,
   *   groupRatchetTree
   * )
   * ```
   */
  async joinGroup(
    welcome: Welcome,
    keyPackage: CompleteKeyPackage,
    ratchetTree: RatchetTree,
  ): Promise<ClientState> {
    return joinGroup(
      welcome,
      keyPackage.publicPackage,
      keyPackage.privatePackage,
      emptyPskIndex,
      await this.ciphersuiteImpl,
      ratchetTree,
    );
  }
}
