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
  | { type: "snapshot"; client: string }
  | {
      type: "scenario_operation";
      operation: string;
      capability: ConformanceCapability;
    };

export type ConformanceActionResult =
  | {
      kind: "supported";
      action: ConformanceAction["type"];
      snapshot?: CanonicalConformanceSnapshot;
    }
  | {
      kind: "unsupported";
      scenarioId: string;
      capability: ConformanceCapability;
      reason: string;
    };

export interface MarmotConformanceSubjectOptions {
  scenarioId: string;
  groups: Map<string, MarmotGroup>;
  network: MockNetwork;
  capabilities: ReadonlySet<ConformanceCapability>;
  now: () => number;
  advanceTime: (milliseconds: number) => void;
  restart: (client: string, group: MarmotGroup) => Promise<MarmotGroup>;
}

const ACTION_CAPABILITY: Record<
  ConformanceAction["type"],
  ConformanceCapability
> = {
  send_application: "application_messaging",
  deliver_all: "transport_delivery",
  advance_time: "virtual_time",
  restart: "crash_reopen",
  snapshot: "transport_delivery",
  scenario_operation: "group_mutation",
};

const STEP_CAPABILITY: Record<string, ConformanceCapability> = {
  create_group: "group_mutation",
  acknowledge_outbound: "transport_delivery",
  deliver_all: "transport_delivery",
  tick: "virtual_time",
  send_app_message: "application_messaging",
  observe: "observation",
  clear_events: "observation",
  invite_members: "group_mutation",
  update_group_data: "group_mutation",
  update_group_profile: "group_mutation",
  observe_exact: "observation",
  probe_bidirectional_decryptability: "application_messaging",
  expect_update_admin_policy_error: "group_mutation",
  update_admin_policy: "group_mutation",
  observe_admin_policy: "observation",
  set_partition: "semantic_transport_faults",
  withhold_message: "semantic_transport_faults",
  release_withheld: "semantic_transport_faults",
  restart_client: "crash_reopen",
  await_quiescence: "virtual_time",
  omit_message: "semantic_transport_faults",
  duplicate_message: "semantic_transport_faults",
  reorder_messages: "semantic_transport_faults",
  clear_partition: "semantic_transport_faults",
  leave: "group_mutation",
  assert: "observation",
  remove_members: "group_mutation",
  in_group: "multi_group",
};

/** Strictly maps one MDK Scenario IR operation to a declared adapter capability. */
export function parseMdkScenarioStep(value: unknown): ConformanceAction {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("Scenario IR step must be an object");
  const step = value as Record<string, unknown>;
  if (typeof step.type !== "string")
    throw new Error("Scenario IR step must declare a string type");
  const capability = STEP_CAPABILITY[step.type];
  if (!capability)
    throw new Error(`Unsupported Scenario IR operation ${step.type}`);
  return {
    type: "scenario_operation",
    operation: step.type,
    capability,
  };
}

/** Production-backed deterministic boundary used by portable conformance scenarios. */
export class MarmotConformanceSubject {
  readonly #dispositions: Array<{ input: string; disposition: string }> = [];

  constructor(readonly options: MarmotConformanceSubjectOptions) {}

  support(action: ConformanceAction): ConformanceActionResult | undefined {
    const capability =
      action.type === "scenario_operation"
        ? action.capability
        : ACTION_CAPABILITY[action.type];
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
        await group.submitIntent({
          kind: "applicationMessage",
          payload: new TextEncoder().encode(action.payload),
        });
        this.#dispositions.push({
          input: action.input,
          disposition: "accepted",
        });
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
        this.options.groups.set(
          action.client,
          await this.options.restart(action.client, group),
        );
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
      case "scenario_operation":
        return {
          kind: "supported",
          action: action.type,
        };
    }
  }

  private requireGroup(client: string): MarmotGroup {
    const group = this.options.groups.get(client);
    if (!group)
      throw new Error(`${this.options.scenarioId}: unknown client ${client}`);
    return group;
  }
}
