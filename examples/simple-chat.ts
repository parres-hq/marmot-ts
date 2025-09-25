import { Marmot, CompleteKeyPackage } from "../src/index"
import { ClientState, MlsPublicMessage } from "ts-mls"

/**
 * Simple chat example demonstrating a practical use case
 *
 * This example shows how to build a basic chat application using Marmot,
 * including participant management and message handling.
 */

interface ChatParticipant {
  id: string
  name: string
  marmot: Marmot
  keyPackage: CompleteKeyPackage
  groupState?: ClientState
}

class SimpleChat {
  private participants: Map<string, ChatParticipant> = new Map()
  private groupCreator?: ChatParticipant
  private messageHistory: Array<{ sender: string, message: string, timestamp: Date }> = []

  async addParticipant(id: string, name: string, publicKey: string): Promise<ChatParticipant> {
    const marmot = new Marmot()
    const credential = marmot.createCredential(publicKey)
    const keyPackage = await marmot.createKeyPackage(credential)

    const participant: ChatParticipant = {
      id,
      name,
      marmot,
      keyPackage,
    }

    this.participants.set(id, participant)
    console.log(`👤 Added participant: ${name} (${id})`)

    return participant
  }

  async createChatGroup(creatorId: string): Promise<void> {
    const creator = this.participants.get(creatorId)
    if (!creator) {
      throw new Error(`Participant ${creatorId} not found`)
    }

    creator.groupState = await creator.marmot.createGroup(creator.keyPackage)
    this.groupCreator = creator

    console.log(`🏗️  ${creator.name} created the chat group`)
  }

  async inviteToChat(participantId: string): Promise<void> {
    if (!this.groupCreator?.groupState) {
      throw new Error("No chat group exists")
    }

    const participant = this.participants.get(participantId)
    if (!participant) {
      throw new Error(`Participant ${participantId} not found`)
    }

    // Create add proposal
    const addProposal = {
      proposalType: "add" as const,
      add: { keyPackage: participant.keyPackage.publicPackage },
    }

    // Commit the proposal
    const commitResult = await this.groupCreator.marmot.createCommit(
      this.groupCreator.groupState,
      [addProposal]
    )
    this.groupCreator.groupState = commitResult.newState

    if (!commitResult.welcome) {
      throw new Error("Expected welcome message")
    }

    // Participant joins the group
    participant.groupState = await participant.marmot.joinGroup(
      commitResult.welcome,
      participant.keyPackage,
      this.groupCreator.groupState.ratchetTree
    )

    // Update other participants' group states
    if (commitResult.commit.wireformat === "mls_public_message") {
      await this.syncGroupState(commitResult.commit as MlsPublicMessage, [participantId, this.groupCreator.id])
    }

    console.log(`✅ ${participant.name} joined the chat`)
  }

  async sendMessage(senderId: string, message: string): Promise<void> {
    const sender = this.participants.get(senderId)
    if (!sender?.groupState) {
      throw new Error(`Sender ${senderId} not in group or group state missing`)
    }

    console.log(`📤 ${sender.name}: ${message}`)

    // Create and send message
    const messageResult = await sender.marmot.createMessage(sender.groupState, message)
    sender.groupState = messageResult.newState

    const encodedMessage = {
      privateMessage: messageResult.privateMessage,
      wireformat: "mls_private_message" as const,
      version: "mls10" as const,
    }

    // Deliver to all other participants
    for (const [participantId, participant] of this.participants) {
      if (participantId !== senderId && participant.groupState) {
        try {
          const processResult = await participant.marmot.processMessage(
            participant.groupState,
            encodedMessage
          )

          if (processResult.kind !== "newState") {
            participant.groupState = processResult.newState
            const decodedMessage = new TextDecoder().decode(processResult.message)
            console.log(`📥 ${participant.name} received: ${decodedMessage}`)
          }
        } catch (error) {
          console.error(`❌ Failed to deliver message to ${participant.name}:`, error)
        }
      }
    }

    // Add to message history
    this.messageHistory.push({
      sender: sender.name,
      message,
      timestamp: new Date()
    })
  }

  private async syncGroupState(publicMessage: MlsPublicMessage, excludeIds: string[]): Promise<void> {
    // Update group state for all participants except those in excludeIds
    for (const [participantId, participant] of this.participants) {
      if (!excludeIds.includes(participantId) && participant.groupState) {
        try {
          const processResult = await participant.marmot.processMessage(
            participant.groupState,
            publicMessage
          )

          if (processResult.kind === "newState") {
            participant.groupState = processResult.newState
          }
        } catch (error) {
          console.error(`❌ Failed to sync group state for ${participant.name}:`, error)
        }
      }
    }
  }

  getParticipants(): string[] {
    return Array.from(this.participants.values())
      .filter(p => p.groupState)
      .map(p => p.name)
  }

  getMessageHistory(): Array<{ sender: string, message: string, timestamp: Date }> {
    return [...this.messageHistory]
  }

  printChatSummary(): void {
    console.log("\n📊 Chat Summary")
    console.log("===============")
    console.log(`Participants: ${this.getParticipants().join(", ")}`)
    console.log(`Messages exchanged: ${this.messageHistory.length}`)
    console.log("\nMessage History:")
    this.messageHistory.forEach((msg, index) => {
      const time = msg.timestamp.toLocaleTimeString()
      console.log(`${index + 1}. [${time}] ${msg.sender}: ${msg.message}`)
    })
    console.log()
  }
}

// Example usage
async function runChatExample(): Promise<void> {
  console.log("💬 Simple Chat Example")
  console.log("======================\n")

  const chat = new SimpleChat()

  try {
    // Add participants
    await chat.addParticipant("alice", "Alice", "alice_key_123")
    await chat.addParticipant("bob", "Bob", "bob_key_456")

    // Alice creates the chat group
    await chat.createChatGroup("alice")

    // Invite Bob
    await chat.inviteToChat("bob")

    console.log(`\n👥 Active participants: ${chat.getParticipants().join(", ")}\n`)

    // Simulate a conversation
    await chat.sendMessage("alice", "Hey Bob! Welcome to our secure chat!")
    await new Promise(resolve => setTimeout(resolve, 100)) // Small delay for readability

    await chat.sendMessage("bob", "Hi Alice! Thanks for setting this up.")
    await new Promise(resolve => setTimeout(resolve, 100))

    await chat.sendMessage("alice", "Great! This chat is end-to-end encrypted using MLS.")
    await new Promise(resolve => setTimeout(resolve, 100))

    await chat.sendMessage("bob", "That's awesome! Our messages are secure.")
    await new Promise(resolve => setTimeout(resolve, 100))

    await chat.sendMessage("alice", "Perfect for our private discussions!")

    // Print summary
    chat.printChatSummary()

    console.log("✅ Chat example completed successfully!")

  } catch (error) {
    console.error("❌ Chat example failed:", error)
    throw error
  }
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runChatExample().catch(console.error)
}

export { SimpleChat, runChatExample }
