import {
  acceptAll,
  Ciphersuite,
  CiphersuiteImpl,
  ClientState,
  createApplicationMessage,
  createCommit,
  createGroup,
  Credential,
  CryptoProvider,
  defaultCryptoProvider,
  defaultCapabilities,
  defaultLifetime,
  emptyPskIndex,
  generateKeyPackage,
  getCiphersuiteFromName,
  getCiphersuiteImpl,
  joinGroup,
  KeyPackage,
  makePskIndex,
  MlsPublicMessage,
  MlsPrivateMessage,
  PrivateKeyPackage,
  processPrivateMessage,
  processMessage,
  Proposal,
  RatchetTree,
  Welcome,
} from "ts-mls"

export type CompleteKeyPackage = {
  publicPackage: KeyPackage
  privatePackage: PrivateKeyPackage
}

export const ciphersuite: Ciphersuite = getCiphersuiteFromName("MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519")

export const defaultExtensions = []

export class Marmot {
  private ciphersuiteImpl: Promise<CiphersuiteImpl>

  constructor(readonly provider: CryptoProvider = defaultCryptoProvider) {
    this.ciphersuiteImpl = getCiphersuiteImpl(ciphersuite, provider)
  }

  createCredential(hexPublicKey: string): Credential {
    return {
      credentialType: "basic",
      identity: new TextEncoder().encode(hexPublicKey),
    }
  }

  async createKeyPackage(credential: Credential) {
    return generateKeyPackage(
      credential,
      defaultCapabilities(),
      defaultLifetime,
      defaultExtensions,
      await this.ciphersuiteImpl
    )
  }

  async createGroup(keyPackage: CompleteKeyPackage, groupId?: Uint8Array) {
    const ciphersuiteImpl = await this.ciphersuiteImpl
    const actualGroupId = groupId || ciphersuiteImpl.rng.randomBytes(32)

    return createGroup(
      actualGroupId,
      keyPackage.publicPackage,
      keyPackage.privatePackage,
      defaultExtensions,
      ciphersuiteImpl
    )
  }

  async createCommit(groupState: ClientState, proposals: Proposal[]) {
    return createCommit(
      {state: groupState, cipherSuite: await this.ciphersuiteImpl},
      {extraProposals: proposals}
    )
  }

  async createMessage(groupState: ClientState, message: string) {
    return createApplicationMessage(
      groupState,
      new TextEncoder().encode(message),
      await this.ciphersuiteImpl
    )
  }

  async processMessage(groupState: ClientState, message: MlsPrivateMessage | MlsPublicMessage) {
    if ('privateMessage' in message) {
      // Handle private message
      return processPrivateMessage(
        groupState,
        message.privateMessage,
        emptyPskIndex,
        await this.ciphersuiteImpl
      )
    } else {
      // Handle public message - use the general processMessage
      return processMessage(
        message,
        groupState,
        makePskIndex(groupState, {}),
        acceptAll,
        await this.ciphersuiteImpl,
      )
    }
  }

  async joinGroup(welcome: Welcome, keyPackage: CompleteKeyPackage, ratchetTree: RatchetTree) {
    return joinGroup(
      welcome,
      keyPackage.publicPackage,
      keyPackage.privatePackage,
      emptyPskIndex,
      await this.ciphersuiteImpl,
      ratchetTree,
    )
  }
}
