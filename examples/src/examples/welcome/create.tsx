import PlaceholderExample from "../../components/placeholder-example";

const TITLE = "Welcome Message Creation";
const FEATURES = `
- Select a user (maybe search) and allow creating a new welcome message for one of their key packages
- Select a locally stored group or create a new ephemerial group (test spam)
- Show raw MLS welcome message as user build it
- Optionally send the welcome message to the target user using gift-wrapping
`;

export default function WelcomeCreate() {
  return <PlaceholderExample title={TITLE} features={FEATURES} />;
}
