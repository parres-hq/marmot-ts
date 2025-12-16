import { NostrEvent } from "applesauce-core/helpers/event";
import { EventSigner } from "applesauce-factory";
import {
  CiphersuiteImpl,
  ClientState,
  CryptoProvider,
  Proposal,
  createCommit,
  createProposal,
  getCiphersuiteFromName,
  getCiphersuiteImpl,
} from "ts-mls";
import { extractMarmotGroupData } from "../../core/client-state.js";
import { createGroupEvent } from "../../core/group-message.js";
import { MarmotGroupData } from "../../core/protocol.js";
import { createWelcomeRumor } from "../../core/welcome.js";
import { GroupStore } from "../../store/group-store.js";
import {
  NoGroupRelaysError,
  NoMarmotGroupDataError,
  NoRelayReceivedEventError,
} from "../errors.js";
import { NostrPool, PublishResponse } from "../interfaces.js";
import { createGiftWrap, hasAck } from "../../utils/index.js";

export type ProposalContext = {
  state: ClientState;
  ciphersuite: CiphersuiteImpl;
  groupData: MarmotGroupData;
};

/** A function that builds an MLS Proposal from group context */
export type ProposalBuilder<T extends Proposal | Proposal[]> = (
  context: ProposalContext,
) => Promise<T>;

/** A method that creates a {@link ProposalBuilder} from a set of arguments */
export type ProposalAction<
  Args extends unknown[],
  T extends Proposal | Proposal[],
> = (...args: Args) => ProposalBuilder<T>;

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

  /** Loads a group from the store */
  static async load(
    groupId: Uint8Array,
    options: Omit<MarmotGroupOptions, "ciphersuite"> & {
      cryptoProvider?: CryptoProvider;
    },
  ): Promise<MarmotGroup> {
    const state = await options.store.get(groupId);
    if (!state) throw new Error(`Group ${groupId} not found`);

    // TODO: probably should clear unapplied proposals from the state since they are going to be read from nostr events

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

    // TODO: we probably shouldn't save unapplied proposals to the store since they are going to be read from nostr events
    await this.store.update(this.state);
    this.dirty = false;
  }

  /** Publish an event to the group relays */
  async publish(event: NostrEvent): Promise<Record<string, PublishResponse>> {
    const relays = this.relays;
    if (!relays) throw new NoGroupRelaysError();
    return await this.pool.publish(relays, event);
  }

  /**
   * Creates and publishes a proposal as a private MLS message.
   * @returns Promise resolving to the publish response from the relays
   */
  async propose<Args extends unknown[], T extends Proposal | Proposal[]>(
    action: ProposalAction<Args, T>,
    ...args: Args
  ): Promise<Record<string, PublishResponse>>;
  async propose<Args extends unknown[], T extends Proposal | Proposal[]>(
    buildProposal: ProposalBuilder<T>,
  ): Promise<Record<string, PublishResponse>>;
  async propose<Args extends unknown[], T extends Proposal | Proposal[]>(
    ...args: Args
  ): Promise<Record<string, PublishResponse>> {
    const groupData = this.groupData;
    if (!groupData) throw new NoMarmotGroupDataError();

    const context: ProposalContext = {
      state: this.state,
      ciphersuite: this.ciphersuite,
      groupData: this.groupData,
    };

    let proposals: T;
    if (args.length === 1) {
      proposals = await (args[0] as ProposalAction<Args, T>)(...args)(context);
    } else {
      proposals = await (args[0] as ProposalBuilder<T>)(context);
    }

    if (!proposals)
      throw new Error("Proposal is undefined. This should not happen.");

    // Handle both single proposals and arrays of proposals
    const proposalArray = Array.isArray(proposals) ? proposals : [proposals];

    // Send all proposals and collect responses
    const responses: Record<string, PublishResponse> = {};
    for (const proposal of proposalArray) {
      const response = await this.sendProposal(proposal as Proposal);
      // Merge responses (later responses override earlier ones for the same relay)
      Object.assign(responses, response);
    }

    return responses;
  }

  /** Sends a proposal to the group relays */
  async sendProposal(
    proposal: Proposal,
  ): Promise<Record<string, PublishResponse>> {
    const { message } = await createProposal(
      this.state,
      false, // private message
      proposal,
      this.ciphersuite,
    );

    // Wrap the message in a group event
    const proposalEvent = await createGroupEvent({
      message,
      state: this.state,
      ciphersuite: this.ciphersuite,
    });

    // Publish to the group's relays
    return await this.publish(proposalEvent);
  }

  /** Creates a commit from existing proposals or new ones and send the commit message to the group */
  async commit(
    ...input: (
      | Proposal
      | ProposalBuilder<Proposal>
      | (Proposal | ProposalBuilder<Proposal>)[]
    )[]
  ) {
    const groupData = this.groupData;
    if (!groupData) throw new NoMarmotGroupDataError();

    const pubkey = await this.signer.getPublicKey();
    if (!groupData.adminPubkeys.includes(pubkey))
      throw new Error("Not a group admin. Cannot commit proposals.");

    // Create proposal context for builders
    const context: ProposalContext = {
      state: this.state,
      ciphersuite: this.ciphersuite,
      groupData: this.groupData,
    };

    // Build the array of proposals
    let proposals: Proposal[] = [];
    for (const item of input.flat()) {
      if (typeof item === "function") proposals.push(await item(context));
      else proposals.push(item);
    }

    // Create a new commit for all the proposals
    const { commit, newState, welcome } = await createCommit(
      { state: this.state, cipherSuite: this.ciphersuite },
      {
        // All messages should be private
        wireAsPublicMessage: false,
        // Pass proposals as extra because unappliedProposals is always empty for marmot groups
        extraProposals: proposals,
      },
    );

    // If new users were added, send the welcome events
    if (welcome) {
      // How do we know what nostr users added?
      const users: string[] = [];

      for (const user of users) {
        // TODO: how do we get the newly added users keypackage event id
        const welcomeRumor = createWelcomeRumor(
          welcome,
          user,
          pubkey,
          groupData.relays,
        );

        // Gift wrap the welcome event to the newly added user
        const giftWrapEvent = await createGiftWrap({
          rumor: welcomeRumor,
          recipient: user,
          signer: this.signer,
        });

        // TODO: how do we get the newly added users inbox relays?
        await this.pool.publish([], giftWrapEvent);

        // TODO: need to detect publish failure to rollback the commit
      }
    }

    // Wrap the commit in a group event
    const commitEvent = await createGroupEvent({
      message: commit,
      state: newState,
      ciphersuite: this.ciphersuite,
    });

    // Publish to the group's relays
    const response = await this.publish(commitEvent);
    if (!hasAck(response)) throw new NoRelayReceivedEventError(commitEvent.id);

    // Update the group state after successful publish
    this.state = newState;

    return response;
  }
}
