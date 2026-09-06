use std::process::Command;

use cgka_engine::key_package::key_package_metadata;
use cgka_traits::engine::KeyPackage;
use cgka_traits::group::ProtocolProfile;
use cgka_traits::{MemberId, TransportEndpoint};
use sha2::{Digest, Sha256};
use transport_nostr_adapter::NostrKeyPackagePublication;

const MDK_SHA: &str = "dbf45c83a8e157302edd13010944ad2c6a9cf9a5";
const KEY_PACKAGE_HEX: &str = "000100050001000120b036ebf3914c293772f73595db0ab14fed01c51e33190e069fbd0ece881a821720f8555d8c8dd62cb8cc46c76a30aa3921ea961d5d6046bb4bf846a0366db4450c20e1ec91ca993f0b1f5b25a131bff8d52ad523094a780d0b7dbc042fb9a2b5304a00012010ca9c41ce77fa315b90d238cefec6da0a1fd4084d55e4c56370b7b596e1ac1502000102000102000602000802000101000000006a9da0c0000000006b0c6cd040800006407c407a00010b0a0001800180038009800c8009406810ca9c41ce77fa315b90d238cefec6da0a1fd4084d55e4c56370b7b596e1ac15000000006a9daed0f21c6af0c40707bd32fc101b0099fbe4931dabf9a74bbbb4c65b0463f0e5dcccd6d431a66f7a2bf5a7e59d75f9f10ea24dab638fe7223466887f8e1cb10c1a92404026af5ef00dea2247b40224d69dd67b23f160645cec6490f7bd8db310c93b9c4a387e3d5835f96e21fdcf5e957a142bdf85add5b61051ecc33fab157381670202070006040300040040408ab6537bebdf9d2a15798392c42802c8eab7a3a4b4f1aae98a547635dc0bdada45effdf40224b90d10497295b81815214c91957262c59a4598fa70728425d80c";

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
    assert_eq!(sha, MDK_SHA, "tag probe requires the pinned MDK SHA");
    sha
}

fn hex_ids(values: &[u16]) -> Vec<String> {
    values
        .iter()
        .map(|value| format!("0x{value:04x}"))
        .collect()
}

fn prettier_tag(tag: &[String], trailing_comma: bool) -> String {
    let compact = serde_json::to_string(tag)
        .expect("tag must serialize")
        .replace("\",\"", "\", \"");
    let suffix = if trailing_comma { "," } else { "" };
    if compact.len() + 4 <= 80 {
        return format!("    {compact}{suffix}");
    }
    let values = tag
        .iter()
        .enumerate()
        .map(|(index, value)| {
            let comma = if index + 1 == tag.len() { "" } else { "," };
            format!(
                "      {}{comma}",
                serde_json::to_string(value).expect("tag value must serialize")
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    format!("    [\n{values}\n    ]{suffix}")
}

fn main() {
    let mdk_sha = checked_mdk_sha();
    let key_package_bytes = hex::decode(KEY_PACKAGE_HEX).expect("fixed KeyPackage hex must decode");
    let key_package =
        KeyPackage::new(key_package_bytes).with_protocol_profile(ProtocolProfile::Current);
    let metadata =
        key_package_metadata(&key_package).expect("MDK must accept the fixed KeyPackage");
    let publication = NostrKeyPackagePublication {
        account_id: MemberId::new(
            hex::decode(&metadata.credential_identity_hex)
                .expect("credential identity must be hex"),
        ),
        key_package,
        key_package_slot_id: "a1".repeat(32),
        key_package_ref: metadata.key_package_ref_hex,
        mls_ciphersuite: format!("0x{:04x}", metadata.ciphersuite),
        mls_extensions: hex_ids(&metadata.mls_extensions),
        mls_proposals: hex_ids(&metadata.mls_proposals),
        // marmot-ts advertises its complete supported decoder set, independently
        // of the components carried by this fixed KeyPackage's own leaf.
        app_components: hex_ids(&[
            0x8001, 0x8003, 0x8004, 0x8005, 0x8006, 0x8007, 0x8008, 0x800c,
        ]),
        publish_endpoints: vec![TransportEndpoint("wss://probe.invalid".into())],
    };
    let event = publication
        .to_event_at(1_788_718_800)
        .expect("MDK must build the canonical kind-30443 event");
    let tags_bytes = serde_json::to_vec(&event.tags).expect("tags must serialize");

    let tags = event
        .tags
        .iter()
        .enumerate()
        .map(|(index, tag)| prettier_tag(tag, index + 1 != event.tags.len()))
        .collect::<Vec<_>>()
        .join("\n");
    println!(
        "{{\n  \"kind\": {},\n  \"mdk_sha\": {},\n  \"source\": {},\n  \"tags\": [\n{}\n  ],\n  \"tags_sha256\": {}\n}}",
        event.kind,
        serde_json::to_string(&mdk_sha).unwrap(),
        serde_json::to_string(
            "refs/mdk transport-nostr-adapter NostrKeyPackagePublication::to_event_at"
        )
        .unwrap(),
        tags,
        serde_json::to_string(&hex::encode(Sha256::digest(tags_bytes))).unwrap(),
    );
}
