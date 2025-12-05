import { bytesToHex } from "@noble/hashes/utils.js";
import { EventSigner } from "applesauce-factory";
import {
  Capabilities,
  ClientState,
  CryptoProvider,
  getCiphersuiteFromName,
  getCiphersuiteImpl,
} from "ts-mls";
import {
  CiphersuiteId,
  CiphersuiteName,
  getCiphersuiteFromId,
} from "ts-mls/crypto/ciphersuite.js";
import { createCredential } from "../core/credential.js";
import { defaultCapabilities } from "../core/default-capabilities.js";
import { createSimpleGroup, SimpleGroupOptions } from "../core/group.js";
import { generateKeyPackage } from "../core/key-package.js";
import { GroupStore } from "../store/group-store.js";
import { KeyPackageStore } from "../store/key-package-store.js";
import { MarmotGroup } from "./marmot-group.js";

export type MarmotClientOptions = {
  /** The capabilities to use for the client */
  capabilities?: Capabilities;
  /** The backend to store and load the groups from */
  groupStore: GroupStore;
  /** The backend to store and load the key packages from */
  keyPackageStore: KeyPackageStore;
  /** The crypto provider to use for cryptographic operations */
  cryptoProvider?: CryptoProvider;
};

export class MarmotClient {
  readonly capabilities: Capabilities;
  readonly groupStore: GroupStore;
  readonly keyPackageStore: KeyPackageStore;

  /** Crypto provider for cryptographic operations */
  public cryptoProvider?: CryptoProvider;

  /** Internal store for group classes */
  private groups = new Map<string, MarmotGroup>();

  constructor(
    readonly signer: EventSigner,
    options: MarmotClientOptions,
  ) {
    this.capabilities = options.capabilities ?? defaultCapabilities();

    // Setup storage
    this.groupStore = options.groupStore;
    this.keyPackageStore = options.keyPackageStore;
  }

  /** Get a ciphersuite implementation from a name or id */
  private async getCiphersuiteImpl(name: CiphersuiteName | CiphersuiteId = 1) {
    const suite =
      typeof name === "string"
        ? getCiphersuiteFromName(name)
        : getCiphersuiteFromId(name);

    // Get a new ciphersuite implementation
    return await getCiphersuiteImpl(suite, this.cryptoProvider);
  }

  /** Gets a group from the cache or loads it from the store */
  async getGroup(groupId: Uint8Array) {
    const groupIdHex = bytesToHex(groupId);
    let group = this.groups.get(groupIdHex);
    if (!group) {
      group = await MarmotGroup.load(groupId, {
        store: this.groupStore,
        signer: this.signer,
        cryptoProvider: this.cryptoProvider,
      });

      // Save group to cache
      this.groups.set(groupIdHex, group);
    }

    return group;
  }

  /** Adds a group to the client */
  async addGroup(state: ClientState): Promise<MarmotGroup> {
    // Get the group's ciphersuite implementation
    const cipherSuite = await getCiphersuiteImpl(
      getCiphersuiteFromName(state.groupContext.cipherSuite),
      this.cryptoProvider,
    );

    const group = new MarmotGroup(state, {
      ciphersuite: cipherSuite,
      store: this.groupStore,
      signer: this.signer,
    });

    // Save the group to the store
    await this.groupStore.add(state);

    // Add the group to the cache
    this.groups.set(bytesToHex(state.groupContext.groupId), group);

    return group;
  }

  /** Creates a new simple group */
  async createGroup(
    name: string,
    options?: SimpleGroupOptions & {
      ciphersuite?: CiphersuiteName | CiphersuiteId;
    },
  ): Promise<Uint8Array> {
    const ciphersuiteImpl = await this.getCiphersuiteImpl(options?.ciphersuite);

    // generate a new key package
    const pubkey = await this.signer.getPublicKey();
    const credential = await createCredential(pubkey);
    const keyPackage = await generateKeyPackage({
      credential,
      ciphersuiteImpl,
    });

    const { clientState } = await createSimpleGroup(
      keyPackage,
      ciphersuiteImpl,
      name,
      // Always include the creator as an admin
      { ...options, adminPubkeys: [pubkey, ...(options?.adminPubkeys || [])] },
    );

    // Save the group to the store
    await this.groupStore.add(clientState);

    // Return the group id
    return clientState.groupContext.groupId;
  }
}
