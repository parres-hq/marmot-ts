import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  nip44,
  NostrEvent,
} from "nostr-tools";
import { hexToBytes, bytesToHex } from "nostr-tools/utils";
import { ClientState } from "ts-mls/clientState.js";
import { CiphersuiteImpl } from "ts-mls/crypto/ciphersuite.js";
import { mlsExporter } from "ts-mls/keySchedule.js";
import {
  decodeMlsMessage,
  encodeMlsMessage,
  type MLSMessage,
} from "ts-mls/message.js";
import { unixNow } from "../utils/nostr.js";
import { getNostrGroupIdHex } from "./client-state.js";
import { GROUP_EVENT_KIND } from "./protocol.js";

/**
 * Gets the exporter secret for NIP-44 encryption from the current group epoch.
 *
 * @param clientState - The ClientState to get exporter secret from
 * @param ciphersuite - The ciphersuite implementation
 * @returns The 32-byte exported secret
 */
async function getExporterSecretForNip44(
  clientState: ClientState,
  ciphersuite: CiphersuiteImpl,
): Promise<Uint8Array> {
  // Use MLS exporter with label "nostr" and context "nostr" to get 32-byte secret
  return mlsExporter(
    clientState.keySchedule.exporterSecret,
    "nostr",
    new TextEncoder().encode("nostr"),
    32,
    ciphersuite,
  );
}

/**
 * Reads a {@link NostrEvent} and returns the {@link MLSMessage} it contains.
 * Decrypts the NIP-44 encrypted content using the exporter_secret from the group state.
 *
 * @param message - The Nostr event containing the encrypted MLS message
 * @param clientState - The ClientState for the group (to get exporter_secret)
 * @param ciphersuite - The ciphersuite implementation
 * @returns The decoded MLSMessage
 */
export async function decryptGroupMessageEvent(
  message: NostrEvent,
  clientState: ClientState,
  ciphersuite: CiphersuiteImpl,
): Promise<MLSMessage> {
  // Step 1: Get exporter_secret for current epoch
  const exporterSecret = await getExporterSecretForNip44(
    clientState,
    ciphersuite,
  );

  // Step 2: Generate keypair from exporter_secret
  // Use exporter_secret bytes directly as private key
  const encryptionPrivateKey = exporterSecret;
  const encryptionPublicKey = getPublicKey(encryptionPrivateKey);

  // Step 3: Decrypt using NIP-44
  // Use exporter_secret as sender key (private), and its public key as receiver key
  const conversationKey = nip44.getConversationKey(
    encryptionPrivateKey,
    encryptionPublicKey,
  );
  const decryptedContent = nip44.decrypt(message.content, conversationKey);

  // Step 4: Decode the serialized MLSMessage
  const serializedMessage = hexToBytes(decryptedContent);
  const decoded = decodeMlsMessage(serializedMessage, 0);
  if (!decoded) throw new Error("Failed to decode MLS message");
  return decoded[0];
}

/**
 * Encrypts the content of a group event using NIP-44.
 *
 * @param state - The ClientState for the group (to get exporter_secret)
 * @param ciphersuite - The ciphersuite implementation
 * @param message - The MLS message to encrypt
 * @returns The encrypted content
 */
export async function createEncryptedGroupEventContent({
  state,
  ciphersuite,
  message,
}: {
  state: ClientState;
  ciphersuite: CiphersuiteImpl;
  message: MLSMessage;
}): Promise<string> {
  // Step 1: Serialize the MLSMessage
  const serializedMessage = encodeMlsMessage(message);

  // Step 2: Get exporter_secret for current epoch
  const exporterSecret = await getExporterSecretForNip44(state, ciphersuite);

  // Step 3: Generate keypair from exporter_secret
  const encryptionPrivateKey = exporterSecret;
  const encryptionPublicKey = getPublicKey(encryptionPrivateKey);

  // NOTE: its inefficient to encrypt the binary MLSMessage as binary -> hex string -> NIP-44 -> base64.
  // It would be better to use the underlying encryption that NIP-44 uses to just encrypt the binary data with the exporter_secret

  // Step 4: Encrypt using NIP-44
  const conversationKey = nip44.getConversationKey(
    encryptionPrivateKey,
    encryptionPublicKey,
  );
  const serializedHex = bytesToHex(serializedMessage);
  return nip44.encrypt(serializedHex, conversationKey);
}

/**
 * Creates a signed Nostr event (kind 445) for a group message (commit, proposal, or application).
 * Encrypts the MLSMessage using NIP-44 with keys derived from the group's exporter_secret.
 *
 * According to MIP-03:
 * 1. Get exporter_secret from current group epoch
 * 2. Generate keypair using exporter_secret as private key
 * 3. Encrypt MLSMessage with NIP-44 using that keypair
 * 4. Publish using a separate ephemeral keypair (for privacy)
 *
 * @param message - The MLS message to encrypt and send
 * @param state - The ClientState for the group (to get exporter_secret and group ID)
 * @param ciphersuite - The ciphersuite implementation
 * @returns Signed Nostr event ready to publish
 */
export async function createGroupEvent({
  message,
  state,
  ciphersuite,
}: {
  message: MLSMessage;
  state: ClientState;
  ciphersuite: CiphersuiteImpl;
}): Promise<NostrEvent> {
  const encryptedContent = await createEncryptedGroupEventContent({
    state,
    ciphersuite,
    message,
  });

  // Step 5: Get group ID from ClientState
  const groupId = getNostrGroupIdHex(state);

  // Step 6: Generate a separate ephemeral keypair for publishing (privacy protection)
  const ephemeralSecretKey = generateSecretKey();
  const ephemeralPublicKey = getPublicKey(ephemeralSecretKey);

  // Step 7: Create and sign the event
  const unsignedEvent = {
    kind: GROUP_EVENT_KIND,
    pubkey: ephemeralPublicKey,
    created_at: unixNow(),
    content: encryptedContent,
    tags: [["h", groupId]],
  };

  return finalizeEvent(unsignedEvent, ephemeralSecretKey);
}
