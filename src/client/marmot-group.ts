import { NostrEvent } from "applesauce-core/helpers/event";
import { EventSigner } from "applesauce-factory";
import {
  CiphersuiteImpl,
  ClientState,
  CryptoProvider,
  getCiphersuiteFromName,
  getCiphersuiteImpl,
} from "ts-mls";
import { extractMarmotGroupData } from "../core/client-state.js";
import { MarmotGroupData } from "../core/protocol.js";
import { GroupStore } from "../store/group-store.js";
import { NostrPool } from "./interfaces.js";
import { addMember } from "./transactions/accept-add-member.js";

/** An strict interface for what the transaction can read from the group */
export type GroupTransactionInput = Readonly<{
  /** The current state of the group */
  state: ClientState;
  /** The nostr relay pool to use for the transaction */
  pool: NostrPool;
  /** The signer used for the clients identity */
  signer: EventSigner;
  /** The ciphersuite implementation to use for the group */
  ciphersuite: CiphersuiteImpl;
}>;

/** A generic type for group state transitions */
export type GroupTransaction = (input: GroupTransactionInput) => Promise<{
  /** New state for the group */
  state: ClientState;
}>;

/** Builder for group transactions */
export type GroupTransactionBuilder<Args extends unknown[]> = (
  ...args: Args
) => GroupTransaction;

/** An async action that is run on a {@link MarmotGroup} */
export type GroupAction = (input: GroupTransactionInput) => Promise<void>;

/** A method that creates a {@link GroupAction} from a set of arguments */
export type GroupActionBuilder<Args extends unknown[]> = (
  ...args: Args
) => GroupAction;

export type MarmotGroupOptions = {
  /** The backend to store and load the group from */
  store: GroupStore;
  /** The signer used for the clients identity */
  signer: EventSigner;
  /** The ciphersuite implementation to use for the group */
  ciphersuite: CiphersuiteImpl;
  /** The nostr relay pool to use for the group */
  pool: NostrPool;
};

export class MarmotGroup {
  /** The backend to store and load the group from */
  readonly store: GroupStore;

  /** The signer used for the clients identity */
  readonly signer: EventSigner;

  /** The ciphersuite implementation to use for the group */
  readonly ciphersuite: CiphersuiteImpl;

  /** The nostr relay pool to use for the group */
  readonly pool: NostrPool;

  /** Whether the group state has been modified */
  dirty = false;

  /** Internal state */
  private _state: ClientState;
  private _groupData: MarmotGroupData | null = null;

  /** Read the current group state */
  get state() {
    return this._state;
  }
  get groupData() {
    // If not cached, extract the group data from the state
    if (!this._groupData) this._groupData = extractMarmotGroupData(this.state);
    return this._groupData;
  }

  /**
   * Overrides the current group state
   * @warning It is not recommended to use this
   */
  set state(newState: ClientState) {
    // Read new group data from the state
    this._groupData = extractMarmotGroupData(newState);

    // Set new state and mark as dirty
    this._state = newState;
    this.dirty = true;
  }

  // Common accessors for marmot group data
  get relays() {
    return this.groupData?.relays;
  }

  constructor(state: ClientState, options: MarmotGroupOptions) {
    this._state = state;
    this.store = options.store;
    this.signer = options.signer;
    this.ciphersuite = options.ciphersuite;
    this.pool = options.pool;
  }

  private createGroupInput(): GroupTransactionInput {
    return Object.freeze({
      state: this.state,
      pool: this.pool,
      signer: this.signer,
      ciphersuite: this.ciphersuite,
    });
  }

  /** Run a {@link GroupAction} on the group */
  async action(action: GroupAction): Promise<void>;
  async action<Args extends unknown[]>(
    action: GroupActionBuilder<Args>,
    ...args: Args
  ): Promise<void>;
  async action(...args: unknown[]): Promise<void> {
    let action: GroupAction;
    if (args.length === 1) {
      action = args[0] as GroupAction;
    } else {
      const builder = args[0] as GroupActionBuilder<unknown[]>;
      action = builder(...args.slice(1));
    }

    await action(this.createGroupInput());
  }

  /** Run a transaction on the group */
  async transaction(transaction: GroupTransaction): Promise<void>;
  async transaction<Args extends unknown[]>(
    builder: GroupTransactionBuilder<Args>,
    ...args: Args
  ): Promise<void>;
  async transaction(...args: unknown[]): Promise<void> {
    let transaction: GroupTransaction;

    // Either run the transaction or create a transaction from a builder
    if (args.length === 1) {
      transaction = args[0] as GroupTransaction;
    } else {
      const builder = args[0] as GroupTransactionBuilder<unknown[]>;
      transaction = builder(...args.slice(1));
    }

    // Run the transaction
    const { state } = await transaction(this.createGroupInput());

    // Update the group state
    this.state = state;

    // Save the group state to the store
    await this.save();
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

  /** Temp add member transaction */
  async addMember(keyPackage: NostrEvent) {
    await this.transaction(
      addMember({ keyPackageEvent: keyPackage, inboxes: this.relays ?? [] }),
    );
  }
}
