import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import {
  defaultExtensionTypes,
  encode,
  getAppDataDictionary,
  groupContextEncoder,
  mlsExporter,
  nodeTypes,
  type CiphersuiteImpl,
  type ClientState,
  type RequiredCapabilities,
} from "ts-mls";
import { getCredentialPubkey } from "../../core/credential.js";

export interface CanonicalConformanceSnapshot {
  group_id: string;
  epoch: string;
  group_context_sha256: string;
  exporter_commitment_sha256: string;
  leaves: Array<{ index: number; account_identity: string; signature_public_key: string; capabilities: { versions: number[]; ciphersuites: number[]; extensions: number[]; proposals: number[]; credentials: number[] } }>;
  required_capabilities: RequiredCapabilities;
  app_data_dictionary: Array<{ component_id: number; value: string }>;
  lifecycle: string;
  convergence_status: string;
  local_gates: string[];
  unresolved_publications: unknown[];
  input_dispositions: Array<{ input: string; disposition: string }>;
  application_outputs: Array<{ identity: string; kind: string; value: string; observed: boolean }>;
}

export interface SnapshotProjectionInput {
  state: ClientState;
  ciphersuite: CiphersuiteImpl;
  lifecycle: string;
  convergenceStatus: string;
  localGates?: string[];
  unresolvedPublications?: unknown[];
  inputDispositions?: Array<{ input: string; disposition: string }>;
  applicationOutputs?: Array<{ identity: string; kind: string; value: Uint8Array | string; observed: boolean }>;
}

const SNAPSHOT_KEYS = [
  "app_data_dictionary", "application_outputs", "convergence_status", "epoch",
  "exporter_commitment_sha256", "group_context_sha256", "group_id", "input_dispositions",
  "leaves", "lifecycle", "local_gates", "required_capabilities", "unresolved_publications",
];

export function validateCanonicalConformanceSnapshot(value: unknown): CanonicalConformanceSnapshot {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("snapshot must be an object");
  const actual = Object.keys(value).sort();
  if (actual.length !== SNAPSHOT_KEYS.length || actual.some((key, index) => key !== SNAPSHOT_KEYS[index]))
    throw new Error("snapshot has unknown or missing fields");
  return value as CanonicalConformanceSnapshot;
}

function requiredCapabilities(state: ClientState): RequiredCapabilities {
  const extension = state.groupContext.extensions.find(
    (candidate) => candidate.extensionType === defaultExtensionTypes.required_capabilities,
  );
  if (!extension || extension.extensionType !== defaultExtensionTypes.required_capabilities)
    return { extensionTypes: [], proposalTypes: [], credentialTypes: [] };
  return {
    extensionTypes: [...extension.extensionData.extensionTypes].sort((a, b) => a - b),
    proposalTypes: [...extension.extensionData.proposalTypes].sort((a, b) => a - b),
    credentialTypes: [...extension.extensionData.credentialTypes].sort((a, b) => a - b),
  };
}

export async function projectCanonicalConformanceSnapshot(input: SnapshotProjectionInput): Promise<CanonicalConformanceSnapshot> {
  const { state } = input;
  const contextBytes = encode(groupContextEncoder, state.groupContext);
  const exporter = await mlsExporter(
    state.keySchedule.exporterSecret,
    "marmot",
    new TextEncoder().encode("convergence-conformance-v1"),
    32,
    input.ciphersuite,
  );
  const commitmentDomain = new TextEncoder().encode("marmot-convergence-conformance-v1");
  const commitment = new Uint8Array(commitmentDomain.length + 1 + exporter.length);
  commitment.set(commitmentDomain);
  commitment.set(exporter, commitmentDomain.length + 1);
  const leaves = state.ratchetTree.flatMap((node, nodeIndex) => {
    if (!node || node.nodeType !== nodeTypes.leaf) return [];
    const capabilities = node.leaf.capabilities;
    return [{
      index: nodeIndex / 2,
      account_identity: getCredentialPubkey(node.leaf.credential),
      signature_public_key: bytesToHex(node.leaf.signaturePublicKey),
      capabilities: {
        versions: [...capabilities.versions].sort((a, b) => a - b),
        ciphersuites: [...capabilities.ciphersuites].sort((a, b) => a - b),
        extensions: [...capabilities.extensions].sort((a, b) => a - b),
        proposals: [...capabilities.proposals].sort((a, b) => a - b),
        credentials: [...capabilities.credentials].sort((a, b) => a - b),
      },
    }];
  });
  return {
    group_id: bytesToHex(state.groupContext.groupId),
    epoch: state.groupContext.epoch.toString(),
    group_context_sha256: bytesToHex(sha256(contextBytes)),
    exporter_commitment_sha256: bytesToHex(sha256(commitment)),
    leaves,
    required_capabilities: requiredCapabilities(state),
    app_data_dictionary: [...(getAppDataDictionary(state.groupContext.extensions) ?? [])]
      .sort((a, b) => a.componentId - b.componentId)
      .map((entry) => ({ component_id: entry.componentId, value: bytesToHex(entry.data) })),
    lifecycle: input.lifecycle,
    convergence_status: input.convergenceStatus,
    local_gates: [...(input.localGates ?? [])].sort(),
    unresolved_publications: [...(input.unresolvedPublications ?? [])],
    input_dispositions: [...(input.inputDispositions ?? [])],
    application_outputs: (input.applicationOutputs ?? []).map((output) => ({
      ...output,
      value: typeof output.value === "string" ? output.value : bytesToHex(output.value),
    })),
  };
}
