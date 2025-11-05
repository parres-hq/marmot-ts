import PlaceholderExample from "../../components/placeholder-example";

const TITLE = "Remove Member";
const FEATURES = `
Select member to remove from group
Create and send remove proposal
Process removal commit
Verify member removal and group state update
`;

export default function RemoveMember() {
  return <PlaceholderExample title={TITLE} features={FEATURES} />;
}
