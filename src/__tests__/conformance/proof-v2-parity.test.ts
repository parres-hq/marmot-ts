import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";
import { defaultCredentialTypes, type LeafNode } from "ts-mls";

import proofV2Rust from "../fixtures/proof-v2-rust.json";
import {
  ACCOUNT_IDENTITY_PROOF_EXTENSION_TYPE,
  accountIdentityProofEventId,
  accountIdentityProofSigningDigest,
  decodeAccountIdentityProof,
  verifyLeafAccountIdentityProof,
  type AccountIdentityProofRequest,
} from "../../core/account-identity-proof.js";

interface ProofV2RustFixture {
  source: string;
  mdk_sha: string;
  profile: "legacy-version-byte-2";
  version: number;
  account_identity_hex: string;
  mls_signature_key_hex: string;
  ciphersuite: number;
  signature_scheme: number;
  event_id_hex: string;
  signature_hex: string;
  proof_hex: string;
}

const fixture = proofV2Rust as ProofV2RustFixture;

function fixtureRequest(): AccountIdentityProofRequest {
  return {
    accountIdentity: hexToBytes(fixture.account_identity_hex),
    mlsSignaturePublicKey: hexToBytes(fixture.mls_signature_key_hex),
    ciphersuite: fixture.ciphersuite,
    signatureScheme: fixture.signature_scheme,
  };
}

function fixtureLeaf(proof: Uint8Array): LeafNode {
  const request = fixtureRequest();
  return {
    credential: {
      credentialType: defaultCredentialTypes.basic,
      identity: request.accountIdentity,
    },
    signaturePublicKey: request.mlsSignaturePublicKey,
    extensions: [
      {
        extensionType: ACCOUNT_IDENTITY_PROOF_EXTENSION_TYPE,
        extensionData: proof,
      },
    ],
  } as unknown as LeafNode;
}

describe("MDK proof-v2 parity", () => {
  it("verifies the Rust-produced legacy version-byte-2 proof through production code", () => {
    expect(fixture.mdk_sha).toBe("dbf45c83a8e157302edd13010944ad2c6a9cf9a5");
    expect(fixture.profile).toBe("legacy-version-byte-2");

    const request = fixtureRequest();
    const proof = hexToBytes(fixture.proof_hex);
    const decoded = decodeAccountIdentityProof(proof);
    expect(decoded.request).toEqual(request);
    expect(bytesToHex(decoded.signature)).toBe(fixture.signature_hex);
    expect(accountIdentityProofEventId(request)).toBe(fixture.event_id_hex);
    expect(
      schnorr.verify(
        decoded.signature,
        accountIdentityProofSigningDigest(request),
        request.accountIdentity,
      ),
    ).toBe(true);
    expect(() =>
      verifyLeafAccountIdentityProof(fixtureLeaf(proof), fixture.ciphersuite),
    ).not.toThrow();
  });

  it("rejects canonical-event and signature mutations", () => {
    const request = fixtureRequest();
    const signature = hexToBytes(fixture.signature_hex);
    const mutatedRequest = {
      ...request,
      mlsSignaturePublicKey: Uint8Array.from(request.mlsSignaturePublicKey),
    };
    mutatedRequest.mlsSignaturePublicKey[0] ^= 1;
    expect(
      schnorr.verify(
        signature,
        accountIdentityProofSigningDigest(mutatedRequest),
        request.accountIdentity,
      ),
    ).toBe(false);

    const mutatedProof = hexToBytes(fixture.proof_hex);
    mutatedProof[mutatedProof.length - 1] ^= 1;
    expect(() =>
      verifyLeafAccountIdentityProof(
        fixtureLeaf(mutatedProof),
        fixture.ciphersuite,
      ),
    ).toThrow("proof signature does not verify for credential identity");
  });
});
