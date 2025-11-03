import PlaceholderExample from "../../components/placeholder-example";

const TITLE = "Key Package Manager";
const FEATURES = `
- View all users published key packages
- Delete individual key packages
- Bulk delete key packages
- Show key package relay distribution
`;

export default function KeyPackageManager() {
  return <PlaceholderExample title={TITLE} features={FEATURES} />;
}
