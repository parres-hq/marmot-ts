import PlaceholderExample from "../../components/placeholder-example";

const TITLE = "Welcome Message Explorer";
const FEATURES = `
Browse received welcome messages
Inspect welcome message structure and content
Show associated key package information
Display relay information from welcome tags
`;

export default function WelcomeMessageExplorer() {
  return <PlaceholderExample title={TITLE} features={FEATURES} />;
}
