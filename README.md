# ts-mls-nostr

A TypeScript library that provides glue code for using the [ts-mls](https://github.com/LukaJCB/ts-mls) library with Nostr protocols, specifically for implementing NIP-EE (Encrypted Events).

This library serves the same purpose as the [nostr-mls](https://github.com/rust-nostr/nostr/tree/master/mls) libraries that wrap the [OpenMLS](https://github.com/openmls/openmls) library. It provides the necessary functionality to implement NIP-EE on top of a complete MLS (Messaging Layer Security) specification implementation.

## Usage

```typescript
import { NostrMLS } from "ts-mls-nostr"

const mls = new NostrMLS()
const aliceCred = mls.createCredential("deadbeef")
const aliceKP = await mls.createKeyPackage(aliceCred)
const aliceGroup = await mls.createGroup(aliceKP)
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details.
