use std::process::Command;
use std::sync::Arc;

use async_trait::async_trait;
use cgka_engine::EngineBuilder;
use cgka_engine::account_identity_proof::{
    AccountIdentityProofRequest, AccountIdentityProofSigner,
};
use cgka_traits::app_components::{
    APP_COMPONENTS_COMPONENT_ID, SAFE_AAD_COMPONENT_ID, decode_components_list,
};
use cgka_traits::engine::CgkaEngine;
use cgka_traits::error::PeelerError;
use cgka_traits::group_context::GroupContextSnapshot;
use cgka_traits::ingest::{PeeledContent, PeeledMessage};
use cgka_traits::peeler::TransportPeeler;
use cgka_traits::transport::{
    EncryptedPayload, Timestamp, TransportEnvelope, TransportMessage, TransportSource,
};
use cgka_traits::types::{MemberId, MessageId};
use k256::schnorr::{SigningKey, signature::hazmat::PrehashSigner};
use openmls::extensions::AppDataDictionary;
use openmls::prelude::{MlsMessageBodyIn, MlsMessageIn, ProtocolVersion};
use serde_json::json;
use sha2::{Digest, Sha256};
use storage_sqlite::SqliteAccountStorage;
use tls_codec::{Deserialize as _, Serialize as _};

const MDK_SHA: &str = "dbf45c83a8e157302edd13010944ad2c6a9cf9a5";
const IDENTITY_SEED: &[u8] = b"marmot-ts genuine SafeAAD engine probe";

struct DeterministicProofSigner(SigningKey);

impl AccountIdentityProofSigner for DeterministicProofSigner {
    fn sign_account_identity_proof(
        &self,
        request: &AccountIdentityProofRequest,
    ) -> Result<[u8; 64], String> {
        if self.0.verifying_key().to_bytes().as_slice() != request.account_identity.as_slice() {
            return Err("request identity differs from probe identity".into());
        }
        let signature: k256::schnorr::Signature = self
            .0
            .sign_prehash(&request.proof_event_id()?)
            .map_err(|error| error.to_string())?;
        Ok(signature.to_bytes())
    }
}

#[derive(Default)]
struct ProbePeeler;

fn message_id(bytes: &[u8]) -> MessageId {
    MessageId::new(Sha256::digest(bytes).to_vec())
}

#[async_trait]
impl TransportPeeler for ProbePeeler {
    async fn peel_group_message(
        &self,
        msg: &TransportMessage,
        _ctx: &GroupContextSnapshot,
    ) -> Result<PeeledMessage, PeelerError> {
        Ok(PeeledMessage {
            id: msg.id.clone(),
            group_id: None,
            sender: None,
            content: PeeledContent::MlsMessage {
                bytes: msg.payload.clone(),
            },
            origin: msg.clone(),
        })
    }

    async fn peel_welcome(&self, msg: &TransportMessage) -> Result<PeeledMessage, PeelerError> {
        Ok(PeeledMessage {
            id: msg.id.clone(),
            group_id: None,
            sender: None,
            content: PeeledContent::Welcome {
                bytes: msg.payload.clone(),
            },
            origin: msg.clone(),
        })
    }

    async fn wrap_group_message(
        &self,
        payload: &EncryptedPayload,
        ctx: &GroupContextSnapshot,
    ) -> Result<TransportMessage, PeelerError> {
        Ok(TransportMessage {
            id: message_id(&payload.ciphertext),
            payload: payload.ciphertext.clone(),
            timestamp: Timestamp(0),
            causal_deps: vec![],
            source: TransportSource("safe-aad-probe".into()),
            envelope: TransportEnvelope::GroupMessage {
                transport_group_id: ctx.transport_group_id().unwrap_or_default().to_vec(),
            },
        })
    }

    async fn wrap_welcome(
        &self,
        payload: &EncryptedPayload,
        recipient: &MemberId,
    ) -> Result<TransportMessage, PeelerError> {
        let mut id_material = payload.ciphertext.clone();
        id_material.extend_from_slice(recipient.as_slice());
        Ok(TransportMessage {
            id: message_id(&id_material),
            payload: payload.ciphertext.clone(),
            timestamp: Timestamp(0),
            causal_deps: vec![],
            source: TransportSource("safe-aad-probe".into()),
            envelope: TransportEnvelope::Welcome {
                recipient: recipient.clone(),
            },
        })
    }
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
    assert_eq!(sha, MDK_SHA, "SafeAAD probe requires the pinned MDK SHA");
    sha
}

fn identity_key() -> SigningKey {
    let mut counter = 0_u64;
    loop {
        let material: [u8; 32] = Sha256::new()
            .chain_update(b"cgka-engine-test-identity-v1")
            .chain_update(IDENTITY_SEED)
            .chain_update(counter.to_be_bytes())
            .finalize()
            .into();
        if let Ok(key) = SigningKey::from_bytes(&material) {
            return key;
        }
        counter += 1;
    }
}

#[tokio::main(flavor = "current_thread")]
async fn main() {
    let mdk_sha = checked_mdk_sha();
    let account_key = identity_key();
    let identity = account_key.verifying_key().to_bytes().to_vec();
    let mut engine = EngineBuilder::new(SqliteAccountStorage::in_memory().unwrap())
        .identity(identity)
        .account_identity_proof_signer(Arc::new(DeterministicProofSigner(account_key)))
        .peeler(Box::new(ProbePeeler))
        .build()
        .expect("current-profile MDK engine must build");

    // This is intentionally the public engine trait call. The probe never
    // reconstructs the private leaf_app_components_extension helper.
    let transported = CgkaEngine::fresh_key_package(&mut engine)
        .await
        .expect("MDK engine must produce a fresh KeyPackage");
    let message = MlsMessageIn::tls_deserialize_exact(transported.bytes())
        .expect("MDK KeyPackage bytes must decode as an MLS message");
    let key_package = match message.extract() {
        MlsMessageBodyIn::KeyPackage(key_package) => key_package,
        other => panic!("expected KeyPackage, got {other:?}"),
    }
    .validate(
        &openmls_rust_crypto::RustCrypto::default(),
        ProtocolVersion::Mls10,
    )
    .expect("MDK-produced KeyPackage must validate");
    let leaf = key_package.leaf_node();
    let dictionary = leaf
        .extensions()
        .app_data_dictionary()
        .expect("MDK leaf must expose app_data_dictionary")
        .dictionary();
    let advertised_app_components = decode_components_list(
        dictionary
            .get(&APP_COMPONENTS_COMPONENT_ID)
            .expect("MDK leaf must advertise app_components"),
    )
    .expect("MDK app_components bytes must decode")
    .into_iter()
    .collect::<Vec<_>>();
    let safe_aad = dictionary
        .get(&SAFE_AAD_COMPONENT_ID)
        .expect("MDK leaf must carry SafeAAD");
    // Current-profile proof bytes embed a creation timestamp and signature.
    // Serialize only the exact SafeAAD entry extracted above into a stable
    // app_data_dictionary projection; no component value is reconstructed.
    let mut stable_dictionary = AppDataDictionary::new();
    stable_dictionary.insert(SAFE_AAD_COMPONENT_ID, safe_aad.to_vec());
    let dictionary_projection = stable_dictionary
        .tls_serialize_detached()
        .expect("SafeAAD dictionary projection must serialize");
    let advertised_extensions = leaf
        .capabilities()
        .extensions()
        .iter()
        .map(|value| u16::from(*value))
        .collect::<Vec<_>>();
    let advertised_proposals = leaf
        .capabilities()
        .proposals()
        .iter()
        .map(|value| u16::from(*value))
        .collect::<Vec<_>>();
    let mut effective_extensions = advertised_extensions.clone();
    effective_extensions.extend(1..=5);
    effective_extensions.sort_unstable();
    effective_extensions.dedup();
    let mut effective_proposals = advertised_proposals.clone();
    effective_proposals.extend(1..=7);
    effective_proposals.sort_unstable();
    effective_proposals.dedup();

    println!(
        "{}",
        serde_json::to_string_pretty(&json!({
            "mdk_sha": mdk_sha,
            "source": "refs/mdk cgka_engine::Engine implementing cgka_traits::CgkaEngine::fresh_key_package",
            "extraction": "Engine::fresh_key_package -> KeyPackage::bytes -> MlsMessageIn -> LeafNode",
            "dictionary_projection": "exact extracted SafeAAD entry only; current account-proof bytes are intentionally excluded as nondeterministic",
            "dictionary_hex": hex::encode(&dictionary_projection),
            "dictionary_sha256": hex::encode(Sha256::digest(&dictionary_projection)),
            "safe_aad_hex": hex::encode(safe_aad),
            "advertised_app_components": advertised_app_components,
            "capabilities": {
                "advertised_extensions": advertised_extensions,
                "effective_extensions": effective_extensions,
                "advertised_proposals": advertised_proposals,
                "effective_proposals": effective_proposals,
            },
        }))
        .expect("fixture projection must serialize")
    );
}
