import PlaceholderExample from "../../components/placeholder-example";

const TITLE = "Add Member";
const FEATURES = `
Select key package for new member addition
Create and send add proposal
Generate and send welcome message
Verify successful member addition
`;

export default function AddMember() {
  return <PlaceholderExample title={TITLE} features={FEATURES} />;
}