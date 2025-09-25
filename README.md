# marmot-ts

[Marmot protocol](https://github.com/parres-hq/marmot) implementation using [ts-mls](https://github.com/LukaJCB/ts-mls).

This library serves the same purpose as the [MDK](https://github.com/parres-hq/mdk) library that wrap the [OpenMLS](https://github.com/openmls/openmls) library. It provides the necessary functionality to implement the [Marmot protocol](https://github.com/parres-hq/marmot) on top of a complete MLS (Messaging Layer Security) specification implementation.

## Examples

See the [`examples/`](examples/) directory for comprehensive examples:

- **[`full-workflow.ts`](examples/full-workflow.ts)** - Complete MLS workflow with multiple participants, group management, and secure messaging
- **[`simple-chat.ts`](examples/simple-chat.ts)** - Practical chat application demonstrating real-world usage

```bash
npm run example:full  # Run the full workflow example
npm run example:chat  # Run the simple chat example
npm test             # Run all tests including examples
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details.
