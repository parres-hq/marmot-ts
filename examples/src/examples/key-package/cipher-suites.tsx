import PlaceholderExample from "../../components/placeholder-example";

const TITLE = "Key Package Cipher Suites";
const FEATURES = `
- Show breakdown of cipher suites of key package published to a relay or user
- Show KDF, Hash, and Signature distribution for all key packages (see https://github.com/LukaJCB/ts-mls?tab=readme-ov-file#supported-ciphersuites)
`;

export default function KeyPackageCipherSuites() {
  return <PlaceholderExample title={TITLE} features={FEATURES} />;
}
