import { NostrEvent } from "applesauce-core/helpers/event";
import { EventSigner } from "applesauce-factory";
import {
  CiphersuiteImpl,
  ClientState,
  CryptoProvider,
  getCiphersuiteFromName,
  getCiphersuiteImpl,
} from "ts-mls";
import { addMemberToGroup } from "../core/group-membership.js";
import { getKeyPackage } from "../core/key-package.js";
import { GroupStore } from "../store/group-store.js";

export type MarmotGroupOptions = {
  /** The backend to store and load the group from */
  store: GroupStore;
  /** The signer used for the clients identity */
  signer: EventSigner;
  /** The ciphersuite implementation to use for the group */
  ciphersuite: CiphersuiteImpl;
};

export class MarmotGroup {
  /** The backend to store and load the group from */
  readonly store: GroupStore;

  /** The signer used for the clients identity */
  readonly signer: EventSigner;

  /** The ciphersuite implementation to use for the group */
  readonly ciphersuite: CiphersuiteImpl;

  /** Whether the group state has been modified */
  dirty = false;

  /** Internal group state */
  private _state: ClientState;

  /** Read the current group state */
  get state() {
    return this._state;
  }

  /**
   * Overrides the current group state
   * @warning It is not recommended to use this
   */
  set state(newState: ClientState) {
    this._state = newState;
    this.dirty = true;
  }

  constructor(state: ClientState, options: MarmotGroupOptions) {
    this.store = options.store;
    this.signer = options.signer;
    this._state = state;
    this.ciphersuite = options.ciphersuite;
  }

  /** Loads a group from the store */
  static async load(
    groupId: Uint8Array,
    options: Omit<MarmotGroupOptions, "ciphersuite"> & {
      cryptoProvider?: CryptoProvider;
    },
  ): Promise<MarmotGroup> {
    const state = await options.store.get(groupId);
    if (!state) throw new Error(`Group ${groupId} not found`);

    // Get the group's ciphersuite implementation
    const cipherSuite = await getCiphersuiteImpl(
      getCiphersuiteFromName(state.groupContext.cipherSuite),
      options.cryptoProvider,
    );

    return new MarmotGroup(state, { ...options, ciphersuite: cipherSuite });
  }

  /** Persists any pending changes to the group state in the store */
  async save() {
    if (!this.dirty) return;
    await this.store.update(this.state);
    this.dirty = false;
  }

  /**
   * A simple test method for adding a member to the group based on a key package event.
   * NOTE: This is way too simple and does not handle publishing the commit event or gift wrapping the welcome message.
   */
  async addMember(keyPackageEvent: NostrEvent) {
    const keyPackage = getKeyPackage(keyPackageEvent);

    const { newState } = await addMemberToGroup(
      this.state,
      keyPackage,
      this.ciphersuite,
    );

    this.state = newState;
  }
}
