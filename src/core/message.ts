import {
  MLSMessage,
  MlsMessageProtocol,
  MlsPrivateMessage,
} from "ts-mls/message.js";

export type PrivateMessage = MlsMessageProtocol & MlsPrivateMessage;

/** Check if a MLSMessage is a private message */
export function isPrivateMessage(
  message: MLSMessage,
): message is PrivateMessage {
  return message.wireformat === "mls_private_message";
}
