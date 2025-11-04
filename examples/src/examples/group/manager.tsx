import PlaceholderExample from "../../components/placeholder-example";

const TITLE = "Group Manager";
const FEATURES = `
Create new groups and store locally in the browser
Remove local groups
Show group metadata
Show locally created groups
`;

export default function GroupManager() {
  return <PlaceholderExample title={TITLE} features={FEATURES} />;
}
