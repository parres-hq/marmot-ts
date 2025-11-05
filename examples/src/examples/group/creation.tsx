import PlaceholderExample from "../../components/placeholder-example";

const TITLE = "Group Creation";
const FEATURES = `
Create new MLS groups with Marmot Group Data Extension
Configure group name, description, and admin pubkeys
Set initial relay list for group communication
Generate cryptographically random group IDs
Validate group creation with required extensions
`;

export default function GroupCreation() {
  return <PlaceholderExample title={TITLE} features={FEATURES} />;
}
