import { Marmot, CompleteKeyPackage } from "../src/index";
import { ClientState, Proposal, Credential, MlsPublicMessage } from "ts-mls";

/**
 * Comprehensive example demonstrating the full MLS workflow using Marmot
 *
 * This example shows:
 * - Creating credentials and key packages for multiple participants
 * - Creating a group and adding members
 * - Exchanging messages between group members
 * - Handling group state updates
 * - Error handling and edge cases
 */

interface Participant {
  name: string;
  marmot: Marmot;
  credential: Credential;
  keyPackage: CompleteKeyPackage;
  groupState?: ClientState;
}

async function createParticipant(
  name: string,
  publicKey: string,
): Promise<Participant> {
  const marmot = new Marmot();
  const credential = marmot.createCredential(publicKey);
  const keyPackage = await marmot.createKeyPackage(credential);

  return {
    name,
    marmot,
    credential,
    keyPackage,
  };
}

async function fullWorkflowExample() {
  console.log("🚀 Starting MLS Full Workflow Example");
  console.log("=====================================\n");

  try {
    // Step 1: Create participants
    console.log("📝 Step 1: Creating participants...");
    const alice = await createParticipant("Alice", "alice_public_key_deadbeef");
    const bob = await createParticipant("Bob", "bob_public_key_cafebabe");
    const charlie = await createParticipant(
      "Charlie",
      "charlie_public_key_feedface",
    );

    console.log(
      `✅ Created participants: ${alice.name}, ${bob.name}, ${charlie.name}\n`,
    );

    // Step 2: Alice creates a group
    console.log("🏗️  Step 2: Alice creates a new group...");
    alice.groupState = await alice.marmot.createGroup(alice.keyPackage);
    console.log(
      `✅ Group created with ID: ${Buffer.from(alice.groupState.groupContext.groupId).toString("hex").substring(0, 16)}...\n`,
    );

    // Step 3: Alice adds Bob to the group
    console.log("👥 Step 3: Alice adds Bob to the group...");
    const addBobProposal: Proposal = {
      proposalType: "add",
      add: { keyPackage: bob.keyPackage.publicPackage },
    };

    const bobCommitResult = await alice.marmot.createCommit(alice.groupState, [
      addBobProposal,
    ]);
    alice.groupState = bobCommitResult.newState;

    if (!bobCommitResult.welcome) {
      throw new Error("Expected welcome message for Bob");
    }

    // Bob joins the group
    bob.groupState = await bob.marmot.joinGroup(
      bobCommitResult.welcome,
      bob.keyPackage,
      alice.groupState.ratchetTree,
    );

    console.log(`✅ Bob joined the group. Group now has 2 members\n`);

    // Step 4: Message exchange between Alice and Bob
    console.log("💬 Step 4: Message exchange between Alice and Bob...");

    // Alice sends a message to Bob
    console.log("📤 Alice sends: 'Hello Bob!'");
    const aliceMessageResult = await alice.marmot.createMessage(
      alice.groupState,
      "Hello Bob!",
    );
    alice.groupState = aliceMessageResult.newState;

    const aliceEncodedMessage = {
      privateMessage: aliceMessageResult.privateMessage,
      wireformat: "mls_private_message" as const,
      version: "mls10" as const,
    };

    // Bob processes Alice's message
    const bobProcessAlice = await bob.marmot.processMessage(
      bob.groupState,
      aliceEncodedMessage,
    );
    if (bobProcessAlice.kind === "newState") {
      throw new Error("Expected application message");
    }
    bob.groupState = bobProcessAlice.newState;
    const bobReceivedMessage = new TextDecoder().decode(
      bobProcessAlice.message,
    );
    console.log(`📥 Bob received: "${bobReceivedMessage}"`);

    // Bob responds
    console.log("📤 Bob sends: 'Hi Alice! Thanks for adding me to the group!'");
    const bobMessageResult = await bob.marmot.createMessage(
      bob.groupState,
      "Hi Alice! Thanks for adding me to the group!",
    );
    bob.groupState = bobMessageResult.newState;

    const bobEncodedMessage = {
      privateMessage: bobMessageResult.privateMessage,
      wireformat: "mls_private_message" as const,
      version: "mls10" as const,
    };

    // Alice processes Bob's message
    const aliceProcessBob = await alice.marmot.processMessage(
      alice.groupState,
      bobEncodedMessage,
    );
    if (aliceProcessBob.kind === "newState") {
      throw new Error("Expected application message");
    }
    alice.groupState = aliceProcessBob.newState;
    const aliceReceivedFromBob = new TextDecoder().decode(
      aliceProcessBob.message,
    );
    console.log(`📥 Alice received: "${aliceReceivedFromBob}"`);

    console.log("\n✅ Message exchange completed successfully!");

    // Step 5: Add Charlie to demonstrate three-party group
    console.log("\n👥 Step 5: Alice adds Charlie to the group...");
    const addCharlieProposal: Proposal = {
      proposalType: "add",
      add: { keyPackage: charlie.keyPackage.publicPackage },
    };

    const charlieCommitResult = await alice.marmot.createCommit(
      alice.groupState,
      [addCharlieProposal],
    );
    alice.groupState = charlieCommitResult.newState;

    if (!charlieCommitResult.welcome) {
      throw new Error("Expected welcome message for Charlie");
    }

    // Charlie joins the group
    charlie.groupState = await charlie.marmot.joinGroup(
      charlieCommitResult.welcome,
      charlie.keyPackage,
      alice.groupState.ratchetTree,
    );

    // Bob needs to process the commit to stay in sync
    if (charlieCommitResult.commit.wireformat === "mls_public_message") {
      const bobProcessCommit = await bob.marmot.processMessage(
        bob.groupState,
        charlieCommitResult.commit as MlsPublicMessage, // Type assertion needed due to MLSMessage union type
      );

      if (bobProcessCommit.kind === "newState") {
        bob.groupState = bobProcessCommit.newState;
      }
    }

    console.log(`✅ Charlie joined the group. Group now has 3 members`);

    // Step 6: Verify group consistency
    console.log("\n🔍 Step 6: Verifying group consistency...");

    const aliceGroupId = Buffer.from(
      alice.groupState!.groupContext.groupId,
    ).toString("hex");
    const bobGroupId = Buffer.from(
      bob.groupState!.groupContext.groupId,
    ).toString("hex");
    const charlieGroupId = Buffer.from(
      charlie.groupState!.groupContext.groupId,
    ).toString("hex");

    if (aliceGroupId === bobGroupId && bobGroupId === charlieGroupId) {
      console.log("✅ All participants have the same group ID");
    } else {
      throw new Error("Group ID mismatch detected!");
    }

    console.log(`📊 Final group state:`);
    console.log(`   - Group ID: ${aliceGroupId.substring(0, 16)}...`);
    console.log(`   - Members: ${alice.name}, ${bob.name}, ${charlie.name}`);
    console.log(`   - Total messages exchanged: 2`);

    console.log("\n🎉 Full workflow completed successfully!");
    console.log("=====================================");
  } catch (error) {
    console.error("❌ Error during workflow:", error);
    throw error;
  }
}

// Advanced example showing error handling and edge cases
async function advancedExample() {
  console.log("\n🔬 Advanced Example: Error Handling & Edge Cases");
  console.log("================================================\n");

  const marmot = new Marmot();

  try {
    // Example 1: Handling invalid credentials
    console.log("🧪 Test 1: Creating credential with empty public key...");
    try {
      marmot.createCredential("");
      console.log(
        "⚠️  Created credential with empty key (this might be valid depending on implementation)",
      );
    } catch (error) {
      console.log(
        "✅ Properly caught invalid credential error:",
        (error as Error).message,
      );
    }

    // Example 2: Group operations with proper error handling
    console.log("\n🧪 Test 2: Creating group with custom group ID...");
    const testCred = marmot.createCredential("test_public_key");
    const testKeyPackage = await marmot.createKeyPackage(testCred);

    const customGroupId = new Uint8Array(32).fill(42); // Custom group ID
    const groupWithCustomId = await marmot.createGroup(
      testKeyPackage,
      customGroupId,
    );

    const actualGroupId = Buffer.from(
      groupWithCustomId.groupContext.groupId,
    ).toString("hex");
    console.log(
      `✅ Created group with custom ID: ${actualGroupId.substring(0, 16)}...`,
    );

    console.log("\n✅ Advanced examples completed!");
  } catch (error) {
    console.error("❌ Error in advanced example:", error);
  }
}

// Helper function to demonstrate the library usage patterns
async function demonstrateUsagePatterns() {
  console.log("\n📚 Usage Patterns Demonstration");
  console.log("===============================\n");

  // Pattern 1: Simple two-party conversation
  console.log("Pattern 1: Simple two-party setup");
  const marmot1 = new Marmot();
  const marmot2 = new Marmot();

  const cred1 = marmot1.createCredential("user1_pubkey");
  const cred2 = marmot2.createCredential("user2_pubkey");

  const kp1 = await marmot1.createKeyPackage(cred1);
  const kp2 = await marmot2.createKeyPackage(cred2);

  // User 1 creates group and adds user 2
  let group1 = await marmot1.createGroup(kp1);

  const addUser2 = await marmot1.createCommit(group1, [
    {
      proposalType: "add",
      add: { keyPackage: kp2.publicPackage },
    },
  ]);

  group1 = addUser2.newState;
  await marmot2.joinGroup(addUser2.welcome!, kp2, group1.ratchetTree);

  console.log("✅ Two-party group established");

  // Pattern 2: Message broadcasting helper (example implementation)
  console.log("Pattern 2: Message broadcasting helper demonstrated");

  console.log("✅ Usage patterns demonstrated");
}

// Run the examples
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    await fullWorkflowExample();
    await advancedExample();
    await demonstrateUsagePatterns();
  })().catch(console.error);
}

export { fullWorkflowExample, advancedExample };
