# Group Implementation Status - marmot-ts

## Overview

This document describes the current state of group creation implementation in marmot-ts, what has been completed, and what needs to be done for full group functionality according to MIP-01.

## Current Implementation Status

### ✅ Completed Features

#### 1. Core Group Creation ([`src/core/group-creation.ts`](src/core/group-creation.ts))

**Functions:**

- [`createGroup()`](src/core/group-creation.ts:19) - Main group creation function
  - Generates private 32-byte MLS group ID
  - Creates MLS group using ts-mls `MLSCreateGroup()`
  - Captures `ClientState` from ts-mls
  - Returns both `CompleteGroup` (with ClientState) and `Group` (serializable)
- [`createSimpleGroup()`](src/core/group-creation.ts:104) - Simplified helper
  - Accepts optional parameters: description, adminPubkeys, relays
  - Automatically generates Marmot Group Data
  - Wraps `createGroup()` with sensible defaults

**MIP-01 Compliance:**

- ✅ Private MLS Group ID (never published to relays)
- ✅ Marmot Group Data Extension (0xF2EE) included
- ✅ Proper TLS serialization
- ✅ Admin pubkeys and relays configuration
- ✅ All required fields initialized

#### 2. Type Definitions ([`src/core/group.ts`](src/core/group.ts))

**Key Types:**

```typescript
// Serializable group data (stored in localforage)
interface Group {
  groupId: Uint8Array; // Private MLS ID
  epoch: number; // Current epoch
  members: Member[]; // Group members
  extensions: Extension[]; // MLS extensions
  marmotGroupData: MarmotGroupData; // Marmot metadata
  ratchetTree: Uint8Array; // Empty for now
  confirmedTranscriptHash: Uint8Array;
  interimTranscriptHash: Uint8Array;
}

// Complete group with MLS state (not serializable)
interface CompleteGroup {
  clientState: ClientState; // MLS state (has functions)
  marmotGroupData: MarmotGroupData;
}

// Result of group creation
interface CreateGroupResult {
  completeGroup: CompleteGroup; // For immediate operations
  group: Group; // For storage/display
  welcomeMessage: Uint8Array; // Empty for creator-only
  commitMessage: Uint8Array; // Empty for creator-only
}
```

#### 3. Group Storage ([`src/core/group-store.ts`](src/core/group-store.ts))

**GroupStore Class:**

- Stores only serializable `Group` data (not `ClientState`)
- Uses localforage backend (like KeyPackageStore)
- Provides CRUD operations: `add()`, `get()`, `list()`, `remove()`, `clear()`
- Supports prefix-based namespacing for multi-user scenarios

**Why ClientState is NOT stored:**

- Contains functions that can't be serialized to JSON/localforage
- Would cause "Function object could not be cloned" error
- Not needed for display purposes

#### 4. Example Implementation ([`examples/src/examples/group/create.tsx`](examples/src/examples/group/create.tsx))

**Features:**

- Draft → Store workflow (consistent with key package creation)
- Automatic admin pubkey (from active account)
- Automatic relay configuration (from relay config)
- Group name and description input
- Display created group details
- Store group locally

**UI Components:**

- ConfigurationForm - Key package selection, name, description
- DraftDisplay - Show group details before storing
- SuccessDisplay - Confirmation after storage

#### 5. UI Integration

**Side Navigation ([`examples/src/components/side-nav.tsx`](examples/src/components/side-nav.tsx)):**

- "Groups (count)" button
- Real-time count of stored groups
- Opens group store modal

**Group Store Modal ([`examples/src/components/group-store-modal.tsx`](examples/src/components/group-store-modal.tsx)):**

- View all stored groups
- Expandable details per group
- Shows: name, ID, epoch, members, admins, relays
- Full JSON view for debugging
- Clear all groups functionality

### 🔄 Current Workflow

```
1. User selects key package
2. User enters group name/description
3. createSimpleGroup() called with:
   - Key package
   - Cipher suite
   - Name
   - Options (description, admin, relays)
4. createGroup() generates:
   - Private MLS group ID
   - Marmot Group Data Extension
   - Calls ts-mls MLSCreateGroup()
   - Returns CompleteGroup + Group
5. User reviews draft
6. User clicks "Store Group Locally"
7. Only Group (serializable) stored in localforage
8. Success confirmation shown
```

## What's Missing for Full Group Functionality

### 🚧 Not Yet Implemented

#### 1. ClientState Persistence

**Problem:**

- `ClientState` contains the MLS group state needed for operations
- Cannot be directly serialized to localforage (has functions)
- Currently lost after page refresh

**Needed for:**

- Adding members to groups
- Removing members from groups
- Sending messages to groups
- Processing incoming messages
- Updating group metadata

**Possible Solutions:**

**Option A: Serialize ClientState to bytes**

```typescript
// If ts-mls provides serialization
const stateBytes = exportClientState(clientState);
// Store stateBytes in localforage
// Later: clientState = importClientState(stateBytes, ciphersuiteImpl);
```

**Option B: Reconstruct from stored data**

```typescript
// Reconstruct ClientState from Group data when needed
// May require storing additional data (ratchet tree, secrets, etc.)
```

**Option C: Keep in memory only**

```typescript
// Store ClientState in memory (Map<groupId, ClientState>)
// Lost on page refresh, but simpler for examples
// User would need to rejoin groups after refresh
```

#### 2. Group Operations

**Add Member:**

- Create Add proposal with member's KeyPackage
- Commit the proposal
- Generate Welcome message for new member
- Publish Commit to Nostr relays
- Send Welcome message to new member

**Remove Member:**

- Create Remove proposal
- Commit the proposal
- Publish Commit to Nostr relays

**Send Message:**

- Create application message
- Encrypt with current epoch secrets
- Publish to Nostr relays with `h` tag (nostr_group_id)

**Process Incoming Messages:**

- Subscribe to Nostr relays for group events
- Decrypt and process messages
- Update ClientState with new epoch

**Update Metadata:**

- Create GroupContextExtensions proposal
- Update Marmot Group Data fields
- Commit and publish

#### 3. Welcome Message Handling

**Joining a Group:**

- Receive Welcome message (via Nostr DM or relay)
- Extract group info and secrets
- Initialize ClientState with Welcome
- Store group locally

**Creating Welcome Messages:**

- When adding members, generate Welcome
- Include ratchet tree extension
- Send to new members

#### 4. Nostr Integration

**Publishing Commits:**

- Create Nostr event (kind TBD in MIP-03)
- Include commit data
- Tag with `h` (nostr_group_id)
- Publish to group's relays

**Subscribing to Group Events:**

- Subscribe to relays with `h` tag filter
- Process incoming commits
- Update local group state

#### 5. Epoch Management

**Tracking Epochs:**

- Store current epoch with group
- Validate incoming messages against epoch
- Handle epoch transitions

**Ratchet Tree Updates:**

- Store ratchet tree state
- Update on commits
- Validate tree hash

## Understanding ClientState

### What is ClientState?

`ClientState` is ts-mls's representation of an MLS group's cryptographic state. It contains:

```typescript
interface ClientState {
  groupContext: GroupContext; // Group metadata
  ratchetTree: Node[]; // Key tree structure
  // ... secrets, keys, and functions for operations
}
```

### Why ClientState Matters

**For Group Operations:**

- **Add/Remove Members**: Requires access to current ratchet tree and secrets
- **Send Messages**: Needs current epoch's encryption keys
- **Process Messages**: Needs to decrypt and update state
- **Commit Changes**: Requires signing keys and tree manipulation

**Without ClientState:**

- Can only VIEW group metadata
- Cannot perform any group operations
- Cannot send or receive messages

### ClientState Lifecycle

```
1. Creation:
   clientState = await MLSCreateGroup(...)

2. Operations:
   // Add member
   const result = await createCommit(
     { state: clientState, ... },
     { extraProposals: [addProposal] }
   );
   clientState = result.newState;  // Updated state

3. Message Processing:
   const result = await processPrivateMessage(
     clientState,
     message,
     ...
   );
   clientState = result.newState;  // Updated state
```

**Key Point:** ClientState is updated with every operation, creating a new state object.

## Recommended Next Steps

### Phase 1: ClientState Persistence (Priority: High)

1. **Research ts-mls serialization**
   - Check if ts-mls has `exportState`/`importState` functions
   - Test serialization/deserialization
   - Document any limitations

2. **Implement storage strategy**
   - If serialization available: Store serialized state
   - If not: Implement in-memory cache with session storage
   - Update GroupStore to handle ClientState

3. **Update Group interface**
   - Add fields needed for reconstruction
   - Ensure all necessary data is stored

### Phase 2: Add Member Example (Priority: High)

1. **Create add-member example**
   - Select existing group
   - Select member's KeyPackage
   - Create Add proposal
   - Commit and display result

2. **Implement Welcome message generation**
   - Generate Welcome for new member
   - Display Welcome message
   - Provide way to send to member

### Phase 3: Message Sending (Priority: Medium)

1. **Create send-message example**
   - Select group
   - Compose message
   - Encrypt and send
   - Display sent message

2. **Implement Nostr publishing**
   - Create proper Nostr event format
   - Publish to group relays
   - Handle errors

### Phase 4: Message Receiving (Priority: Medium)

1. **Create receive-message example**
   - Subscribe to group events
   - Decrypt incoming messages
   - Update group state
   - Display messages

### Phase 5: Full Group Manager (Priority: Low)

1. **Comprehensive group management UI**
   - List all groups
   - View group details
   - Perform all operations
   - Message history

## Technical Considerations

### Storage Size

**Current Approach:**

- Only stores serializable Group data (~1-2 KB per group)
- Efficient for display purposes

**With ClientState:**

- ClientState can be large (ratchet tree grows with members)
- May need compression or selective storage
- Consider storage limits (localforage ~10MB default)

### Performance

**Current:**

- Fast group creation
- Instant display of stored groups

**With Operations:**

- Cryptographic operations can be slow
- May need loading states
- Consider web workers for heavy operations

### Security

**Current:**

- Private MLS group ID never exposed
- Admin verification in place

**Future:**

- Secure ClientState storage (encryption?)
- Key rotation strategies
- Backup and recovery

## Conclusion

The current implementation provides a **solid foundation** for group creation in marmot-ts:

✅ **What Works:**

- MIP-01 compliant group creation
- Proper Marmot Group Data Extension
- Storage and display of groups
- Clean, focused example

🚧 **What's Needed:**

- ClientState persistence strategy
- Group operation implementations
- Nostr integration for commits/messages
- Welcome message handling

The architecture is **extensible and well-structured**, making it straightforward to add the missing functionality in future iterations. The separation between `CompleteGroup` (with ClientState) and `Group` (serializable) provides a clear path forward.

## References

- [MIP-01: Group Construction & Marmot Group Data Extension](https://github.com/parres-hq/marmot/blob/master/01.md)
- [RFC 9420: The Messaging Layer Security (MLS) Protocol](https://www.rfc-editor.org/rfc/rfc9420.html)
- [ts-mls Documentation](https://github.com/mlswg/mls-implementations)
