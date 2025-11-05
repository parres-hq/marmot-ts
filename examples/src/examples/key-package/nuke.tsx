import PlaceholderExample from "../../components/placeholder-example";

const TITLE = "Key Package Nuke (Bulk Removal)";
const FEATURES = `
Remove all key packages at once
Option to preserve last-resort key packages
Confirmation dialog with count of packages to be deleted
Log of removal operations
`;

export default function KeyPackageNuke() {
  return <PlaceholderExample title={TITLE} features={FEATURES} />;
}
