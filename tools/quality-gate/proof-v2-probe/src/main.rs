use std::process::Command;

use cgka_engine::account_identity_proof::{
    ACCOUNT_IDENTITY_PROOF_EXTENSION_TYPE, AccountIdentityProofRequest, AccountIdentityProofSigner,
    account_identity_proof_extension,
};
use k256::schnorr::{SigningKey, signature::hazmat::PrehashSigner};
use nostr::secp256k1::schnorr::Signature;
use openmls::extensions::Extension;
use openmls::prelude::{Ciphersuite, SignatureScheme};
use serde_json::json;
use sha2::{Digest, Sha256};

const MDK_SHA: &str = "dbf45c83a8e157302edd13010944ad2c6a9cf9a5";
const ACCOUNT_SEED: &[u8] = b"marmot-ts proof-v2 fixture account secret key";
const MLS_KEY_SEED: &[u8] = b"marmot-ts proof-v2 fixture mls signature key";

struct DeterministicProofSigner(SigningKey);

impl AccountIdentityProofSigner for DeterministicProofSigner {
    fn sign_account_identity_proof(
        &self,
        request: &AccountIdentityProofRequest,
    ) -> Result<[u8; 64], String> {
        let signature: k256::schnorr::Signature = self
            .0
            .sign_prehash(&request.proof_event_id()?)
            .map_err(|error| error.to_string())?;
        Ok(signature.to_bytes())
    }
}

fn sha256(input: &[u8]) -> [u8; 32] {
    Sha256::digest(input).into()
}

fn checked_mdk_sha() -> String {
    let output = Command::new("git")
        .args(["-C", "refs/mdk", "rev-parse", "HEAD"])
        .output()
        .expect("git must be available to pin the MDK probe");
    assert!(output.status.success(), "failed to resolve refs/mdk HEAD");
    let sha = String::from_utf8(output.stdout)
        .expect("git SHA must be UTF-8")
        .trim()
        .to_owned();
    assert_eq!(sha, MDK_SHA, "proof-v2 probe requires the pinned MDK SHA");
    sha
}

fn main() {
    let mdk_sha = checked_mdk_sha();
    let account_secret = sha256(ACCOUNT_SEED);
    let signing_key = SigningKey::from_bytes(&account_secret)
        .expect("fixed account seed must produce a valid secret key");
    let account_identity: [u8; 32] = signing_key.verifying_key().to_bytes().into();
    let mls_signature_key = sha256(MLS_KEY_SEED);
    let request = AccountIdentityProofRequest::new(
        account_identity,
        mls_signature_key,
        Ciphersuite::MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519,
        SignatureScheme::ED25519,
    );
    let event_id = request
        .proof_event_id()
        .expect("MDK must construct the canonical legacy proof event");
    let deterministic_signature: k256::schnorr::Signature = signing_key
        .sign_prehash(&event_id)
        .expect("fixed account key must sign the proof event");
    let signed = request
        .proof_event()
        .expect("MDK must construct the canonical legacy proof event")
        .add_signature(
            Signature::from_slice(&deterministic_signature.to_bytes())
                .expect("k256 signature must be a valid Nostr signature"),
        )
        .expect("MDK must accept the deterministic proof signature");
    let signature = request
        .signature_from_signed_event(signed)
        .expect("MDK must accept its canonical signed proof event");
    let extension = account_identity_proof_extension(
        &account_identity,
        &mls_signature_key,
        Ciphersuite::MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519,
        SignatureScheme::ED25519,
        &DeterministicProofSigner(signing_key),
    )
    .expect("MDK must encode the legacy proof extension");
    let proof = match extension {
        Extension::Unknown(extension_type, unknown) => {
            assert_eq!(extension_type, ACCOUNT_IDENTITY_PROOF_EXTENSION_TYPE);
            unknown.0
        }
        _ => panic!("MDK proof must use the legacy unknown extension carrier"),
    };

    println!(
        "{}",
        serde_json::to_string_pretty(&json!({
            "source": "refs/mdk crates/cgka-engine account_identity_proof.rs",
            "mdk_sha": mdk_sha,
            "profile": "legacy-version-byte-2",
            "version": 2,
            "account_identity_hex": hex::encode(account_identity),
            "mls_signature_key_hex": hex::encode(mls_signature_key),
            "ciphersuite": 1,
            "signature_scheme": 2055,
            "event_id_hex": hex::encode(event_id),
            "signature_hex": hex::encode(signature),
            "proof_hex": hex::encode(proof),
        }))
        .expect("fixture JSON must serialize")
    );
}
