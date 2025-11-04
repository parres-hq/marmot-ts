import PlaceholderExample from "../../components/placeholder-example";

const TITLE = "Key Package Creation";
const FEATURES = `
Create new key packages for user
Publish key package to relays
Allow selecting all possible options and cipher suites
Store private keys locally in the browser (for use in other examples)
Ensure key packages are tagged with "client" tag
Ensure key packages have correct expiration set
`;

export default function KeyPackageCreate() {
  return <PlaceholderExample title={TITLE} features={FEATURES} />;
}
