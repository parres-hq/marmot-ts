import PlaceholderExample from "../../components/placeholder-example";

const TITLE = "Encoder/Decoder (Binary/UTF-8)";
const FEATURES = `
Convert between binary and UTF-8 representations
Test TLS serialization/deserialization of group data
Validate UTF-8 encoding of group metadata
Show hex and base64 representations of binary data
`;

export default function EncoderDecoder() {
  return <PlaceholderExample title={TITLE} features={FEATURES} />;
}
