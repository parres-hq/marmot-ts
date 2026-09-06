use std::convert::Infallible;
use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, UNIX_EPOCH};

use cgka_engine::account_identity_proof::{
    AccountIdentityProofRequest, AccountIdentityProofSigner, account_identity_proof_component,
};
use cgka_engine::key_package::key_package_metadata;
use cgka_traits::app_components::{
    ACCOUNT_IDENTITY_PROOF_COMPONENT_ID, APP_COMPONENTS_COMPONENT_ID, AppComponentSet,
    default_group_components, encode_components_list,
};
use cgka_traits::engine::KeyPackage as TransportKeyPackage;
use cgka_traits::group::ProtocolProfile;
use k256::schnorr::{SigningKey, signature::hazmat::PrehashSigner};
use openmls::extensions::{AppDataDictionary, AppDataDictionaryExtension, Extension, Extensions};
use openmls::prelude::{
    BasicCredential, Capabilities, CredentialWithKey, ExtensionType, KeyPackage, Lifetime,
    MlsMessageOut, ProposalType,
};
use openmls_basic_credential::SignatureKeyPair;
use openmls_memory_storage::MemoryStorage;
use openmls_rust_crypto::RustCrypto;
use openmls_traits::OpenMlsProvider;
use openmls_traits::random::OpenMlsRand;
use openmls_traits::types::Ciphersuite;
use serde_json::json;
use sha2::{Digest, Sha256};
use tls_codec::Serialize as _;

const MDK_SHA: &str = "dbf45c83a8e157302edd13010944ad2c6a9cf9a5";
const VALIDATION_TIME: u64 = 1_788_718_800;
const ACCEPTED_RANGE: u64 = 7_261_200;
const ACCOUNT_SEED: &[u8] = b"marmot-ts lifetime fixture account";
const MLS_SIGNING_SEED: &[u8] = b"marmot-ts lifetime fixture mls signing";

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

#[derive(Debug)]
struct DeterministicRand(AtomicU64);

impl Default for DeterministicRand {
    fn default() -> Self {
        Self(AtomicU64::new(0))
    }
}

impl OpenMlsRand for DeterministicRand {
    type Error = Infallible;

    fn random_array<const N: usize>(&self) -> Result<[u8; N], Self::Error> {
        let bytes = self.random_vec(N)?;
        Ok(bytes.try_into().expect("requested exact array length"))
    }

    fn random_vec(&self, len: usize) -> Result<Vec<u8>, Self::Error> {
        let call = self.0.fetch_add(1, Ordering::SeqCst);
        let mut out = Vec::with_capacity(len);
        let mut block = 0_u64;
        while out.len() < len {
            out.extend_from_slice(
                &Sha256::new()
                    .chain_update(b"marmot-ts lifetime probe rand v1")
                    .chain_update(call.to_be_bytes())
                    .chain_update(block.to_be_bytes())
                    .finalize(),
            );
            block += 1;
        }
        out.truncate(len);
        Ok(out)
    }
}

#[derive(Debug, Default)]
struct DeterministicProvider {
    crypto: RustCrypto,
    rand: DeterministicRand,
    storage: MemoryStorage,
}

impl OpenMlsProvider for DeterministicProvider {
    type CryptoProvider = RustCrypto;
    type RandProvider = DeterministicRand;
    type StorageProvider = MemoryStorage;

    fn crypto(&self) -> &Self::CryptoProvider {
        &self.crypto
    }

    fn rand(&self) -> &Self::RandProvider {
        &self.rand
    }

    fn storage(&self) -> &Self::StorageProvider {
        &self.storage
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
    assert_eq!(sha, MDK_SHA, "lifetime probe requires the pinned MDK SHA");
    sha
}

fn boundary(lifetime: Lifetime) -> serde_json::Value {
    let current = lifetime
        .validate_with_time(UNIX_EPOCH + Duration::from_secs(VALIDATION_TIME))
        .is_ok();
    json!({
        "not_before": lifetime.not_before(),
        "not_after": lifetime.not_after(),
        "current": current,
        "range_acceptable": lifetime.has_acceptable_range(),
        "accepted": current && lifetime.has_acceptable_range(),
    })
}

fn main() {
    let mdk_sha = checked_mdk_sha();
    let ciphersuite = Ciphersuite::MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519;
    let account_key = SigningKey::from_bytes(&sha256(ACCOUNT_SEED))
        .expect("fixed account seed must produce a valid secret key");
    let account_identity: [u8; 32] = account_key.verifying_key().to_bytes().into();
    let private_signing_key = sha256(MLS_SIGNING_SEED).to_vec();
    let public_signing_key = ed25519_dalek::SigningKey::from_bytes(
        private_signing_key
            .as_slice()
            .try_into()
            .expect("SHA-256 seed is 32 bytes"),
    )
    .verifying_key()
    .to_bytes()
    .to_vec();
    let signer = SignatureKeyPair::from_raw(
        ciphersuite.signature_algorithm(),
        private_signing_key,
        public_signing_key.clone(),
    );
    let proof = account_identity_proof_component(
        &account_identity,
        &public_signing_key,
        ciphersuite,
        ciphersuite.signature_algorithm(),
        VALIDATION_TIME,
        &DeterministicProofSigner(account_key),
    )
    .expect("MDK must encode the current account proof component");

    let mut advertised_components = AppComponentSet::new(default_group_components());
    advertised_components.insert(APP_COMPONENTS_COMPONENT_ID);
    advertised_components.insert(ACCOUNT_IDENTITY_PROOF_COMPONENT_ID);
    let mut dictionary = AppDataDictionary::new();
    dictionary.insert(
        APP_COMPONENTS_COMPONENT_ID,
        encode_components_list(&advertised_components.ids),
    );
    dictionary.insert(ACCOUNT_IDENTITY_PROOF_COMPONENT_ID, proof);
    let leaf_extension = Extension::AppDataDictionary(AppDataDictionaryExtension::new(dictionary));
    let capabilities = Capabilities::new(
        None,
        Some(&[ciphersuite]),
        Some(&[ExtensionType::AppDataDictionary]),
        Some(&[ProposalType::AppDataUpdate]),
        None,
    );
    let credential_with_key = CredentialWithKey {
        credential: BasicCredential::new(account_identity.to_vec()).into(),
        signature_key: public_signing_key.into(),
    };
    let lifetime = Lifetime::init(
        VALIDATION_TIME - 3_600,
        VALIDATION_TIME - 3_600 + ACCEPTED_RANGE,
    );
    let provider = DeterministicProvider::default();
    let bundle = KeyPackage::builder()
        .leaf_node_capabilities(capabilities)
        .leaf_node_extensions(Extensions::single(leaf_extension).unwrap())
        .key_package_lifetime(lifetime)
        .mark_as_last_resort()
        .build(ciphersuite, &provider, &signer, credential_with_key)
        .expect("deterministic KeyPackage must build");
    let message: MlsMessageOut = bundle.key_package().clone().into();
    let key_package_bytes = message.tls_serialize_detached().unwrap();
    let transported = TransportKeyPackage::new(key_package_bytes.clone())
        .with_protocol_profile(ProtocolProfile::Current);
    let metadata = key_package_metadata(&transported)
        .expect("MDK must accept the fixed current-profile KeyPackage");
    let lifetime_bytes = lifetime.tls_serialize_detached().unwrap();

    let advertised_extensions = metadata.mls_extensions;
    let advertised_proposals = metadata.mls_proposals;
    let mut effective_extensions = advertised_extensions.clone();
    effective_extensions.extend(1..=5);
    effective_extensions.sort_unstable();
    effective_extensions.dedup();
    let mut effective_proposals = advertised_proposals.clone();
    effective_proposals.extend(1..=7);
    effective_proposals.sort_unstable();
    effective_proposals.dedup();
    let projection = json!({
        "not_before": lifetime.not_before(),
        "not_after": lifetime.not_after(),
        "serialized_hex": hex::encode(&lifetime_bytes),
        "advertised_extensions": advertised_extensions,
        "effective_extensions": effective_extensions,
        "advertised_proposals": advertised_proposals,
        "effective_proposals": effective_proposals,
        "advertised_app_components": metadata.app_components,
    });
    let projection_bytes = serde_json::to_vec(&projection).unwrap();

    println!(
        "{}",
        serde_json::to_string_pretty(&json!({
            "source": "refs/mdk cgka-engine key_package.rs + capabilities.rs at pinned OpenMLS",
            "mdk_sha": mdk_sha,
            "openmls_rev": "59e7d3b27a7e95237879dd5478de1fd90eff7ada",
            "projection_version": 1,
            "validation_time": VALIDATION_TIME,
            "lifetime": {
                "not_before": lifetime.not_before(),
                "not_after": lifetime.not_after(),
                "serialized_hex": hex::encode(lifetime_bytes),
                "projection_sha256": hex::encode(sha256(&projection_bytes)),
                "key_package_tls_sha256": hex::encode(sha256(&key_package_bytes)),
                "key_package_tls_hex": hex::encode(&key_package_bytes),
            },
            "capabilities": projection,
            "boundaries": {
                "accepted_cap": boundary(Lifetime::init(VALIDATION_TIME - 3_600, VALIDATION_TIME - 3_600 + ACCEPTED_RANGE)),
                "one_over": boundary(Lifetime::init(VALIDATION_TIME - 3_600, VALIDATION_TIME - 3_600 + ACCEPTED_RANGE + 1)),
                "expired": boundary(Lifetime::init(VALIDATION_TIME - 10_000, VALIDATION_TIME - 7_201)),
                "not_yet_current": boundary(Lifetime::init(VALIDATION_TIME + 7_201, VALIDATION_TIME + 10_000)),
            },
        }))
        .unwrap()
    );
}
