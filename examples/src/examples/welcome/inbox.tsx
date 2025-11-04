import PlaceholderExample from "../../components/placeholder-example";

const TITLE = "Welcome Message Inbox";
const FEATURES = `
Allow user to see an "inbox" of MIP-03 welcome messages
Show target key package (which key package will be consumed if accepted)
Parse group metadata if private key exists for key package
Show as much information as posssible if private key is missing
Include debug modal for showing internals of the gift-wrapped event
Allow user to unwrap indevidual gift-wraps or "unwrap all"
Only show gift-wraps that contain a kind 444 rumor
`;

export default function WelcomeInbox() {
  return <PlaceholderExample title={TITLE} features={FEATURES} />;
}
