import PlaceholderExample from "../../components/placeholder-example";

const TITLE = "Key Package Removal";
const FEATURES = `
Select and delete specific key packages
Batch delete multiple key packages
Verify deletion from local storage and relays
Show confirmation of successful removal
`;

export default function KeyPackageRemoval() {
  return <PlaceholderExample title={TITLE} features={FEATURES} />;
}
