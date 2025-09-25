# marmot-ts

[Marmot protocol](https://github.com/parres-hq/marmot) implementation using [ts-mls](https://github.com/LukaJCB/ts-mls).

This library serves the same purpose as the [MDK](https://github.com/parres-hq/mdk) library that wrap the [OpenMLS](https://github.com/openmls/openmls) library. It provides the necessary functionality to implement the [Marmot protocol](https://github.com/parres-hq/marmot) on top of a complete MLS (Messaging Layer Security) specification implementation.

## Usage

```typescript
import { Marmot } from "marmot-ts"

const marmot = new Marmot()
const aliceCred = marmot.createCredential("deadbeef")
const aliceKP = await marmot.createKeyPackage(aliceCred)
const aliceGroup = await marmot.createGroup(aliceKP)
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details.
