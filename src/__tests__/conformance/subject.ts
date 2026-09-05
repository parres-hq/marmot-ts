import type { MarmotGroup } from "../../client/group/marmot-group.js";
import type { MockNetwork } from "../helpers/mock-network.js";
import type { CanonicalConformanceSnapshot } from "./snapshot.js";
import { projectCanonicalConformanceSnapshot } from "./snapshot.js";
import type { ConformanceCapability } from "./manifest.js";

export type ConformanceAction =
  | { type: "send_application"; client: string; input: string; payload: string }
  | { type: "deliver_all" }
  | { type: "advance_time"; milliseconds: number }
  | { type: "restart"; client: string }
  | { type: "snapshot"; client: string };

export type ConformanceActionResult =
  | { kind: "supported"; action: ConformanceAction["type"]; snapshot?: CanonicalConformanceSnapshot }
  | { kind: "unsupported"; scenarioId: string; capability: ConformanceCapability; reason: string };

export interface MarmotConformanceSubjectOptions {
  scenarioId: string;
  groups: Map<string, MarmotGroup>;
  network: MockNetwork;
  capabilities: ReadonlySet<ConformanceCapability>;
  now: () => number;
  advanceTime: (milliseconds: number) => void;
  restart: (client: string, group: MarmotGroup) => Promise<MarmotGroup>;
}

const ACTION_CAPABILITY: Record<ConformanceAction["type"], ConformanceCapability> = {
  send_application: "application_messaging",
  deliver_all: "transport_delivery",
  advance_time: "virtual_time",
  restart: "crash_reopen",
  snapshot: "transport_delivery",
};

/** Production-backed deterministic boundary used by portable conformance scenarios. */
export class MarmotConformanceSubject {
  readonly #dispositions: Array<{ input: string; disposition: string }> = [];

  constructor(readonly options: MarmotConformanceSubjectOptions) {}

  support(action: ConformanceAction): ConformanceActionResult | undefined {
    const capability = ACTION_CAPABILITY[action.type];
    if (this.options.capabilities.has(capability)) return undefined;
    return {
      kind: "unsupported",
      scenarioId: this.options.scenarioId,
      capability,
      reason: `subject does not support ${capability}`,
    };
  }

  async execute(action: ConformanceAction): Promise<ConformanceActionResult> {
    const unsupported = this.support(action);
    if (unsupported) return unsupported;
    switch (action.type) {
      case "send_application": {
        const group = this.requireGroup(action.client);
        await group.submitIntent({ kind: "applicationMessage", payload: new TextEncoder().encode(action.payload) });
        this.#dispositions.push({ input: action.input, disposition: "accepted" });
        return { kind: "supported", action: action.type };
      }
      case "deliver_all":
        this.options.network.deliverQueued();
        return { kind: "supported", action: action.type };
      case "advance_time":
        this.options.advanceTime(action.milliseconds);
        return { kind: "supported", action: action.type };
      case "restart": {
        const group = this.requireGroup(action.client);
        await group.save(true);
        this.options.groups.set(action.client, await this.options.restart(action.client, group));
        return { kind: "supported", action: action.type };
      }
      case "snapshot": {
        const group = this.requireGroup(action.client);
        return {
          kind: "supported",
          action: action.type,
          snapshot: await projectCanonicalConformanceSnapshot({
            state: group.state,
            ciphersuite: group.ciphersuite,
            lifecycle: group.lifecycle,
            convergenceStatus: group.convergenceStatus,
            inputDispositions: this.#dispositions,
          }),
        };
      }
    }
  }

  private requireGroup(client: string): MarmotGroup {
    const group = this.options.groups.get(client);
    if (!group) throw new Error(`${this.options.scenarioId}: unknown client ${client}`);
    return group;
  }
}
