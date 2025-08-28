import {describe, it, expect} from "vitest"
import {NostrMLS} from "../src/index"

describe("NostrMLS", () => {
  it("should handle basic MLS workflow: create group, add member, exchange messages", async () => {
    const nostrMLS = new NostrMLS()

    // Setup Alice's credential and key package
    const aliceCredential = nostrMLS.createCredential("alice_pubkey")
    const aliceKeyPackage = await nostrMLS.createKeyPackage(aliceCredential)

    // Alice creates a new group
    let aliceGroup = await nostrMLS.createGroup(aliceKeyPackage)

    // Setup Bob's credential and key package
    const bobCredential = nostrMLS.createCredential("bob_pubkey")
    const bobKeyPackage = await nostrMLS.createKeyPackage(bobCredential)

    // Alice creates a proposal to add Bob to the group
    const addBobProposal = {
      proposalType: "add" as const,
      add: { keyPackage: bobKeyPackage.publicPackage },
    }

    // Alice commits the proposal
    const commitResult = await nostrMLS.createCommit(aliceGroup, [addBobProposal])
    aliceGroup = commitResult.newState

    // Verify the commit result has a welcome message
    expect(commitResult.welcome).toBeDefined()

    // Bob joins the group using the welcome message
    let bobGroup = await nostrMLS.joinGroup(
      commitResult.welcome!,
      bobKeyPackage,
      aliceGroup.ratchetTree
    )

    // Alice sends a message to Bob
    const messageText = "Hello bob!"
    const aliceMessageResult = await nostrMLS.createMessage(aliceGroup, messageText)
    aliceGroup = aliceMessageResult.newState

    // Bob processes Alice's message
    const bobProcessResult = await nostrMLS.processMessage(bobGroup, aliceMessageResult)
    bobGroup = bobProcessResult.newState

    // Verify Bob received the correct message
    const decodedMessage = new TextDecoder().decode(bobProcessResult.message!)
    expect(decodedMessage).toBe(messageText)

    // Verify both groups have the same epoch (synchronized state)
    expect(aliceGroup.epoch).toBe(bobGroup.epoch)
  })
})
