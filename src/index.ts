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
  processMessage,
  Proposal,
  RatchetTree,
  Welcome,
} from "ts-mls"

export type CompleteKeyPackage = {
  publicPackage: KeyPackage
  privatePackage: PrivateKeyPackage
}

export const ciphersuite: Ciphersuite = getCiphersuiteFromName("MLS_256_XWING_AES256GCM_SHA512_Ed25519")

export const defaultExtensions = []

export class NostrMLS {
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

  async createGroup(keyPackage: CompleteKeyPackage) {
    const ciphersuiteImpl = await this.ciphersuiteImpl

    return createGroup(
      ciphersuiteImpl.rng.randomBytes(32),
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
    return processMessage(
      message,
      groupState,
      makePskIndex(groupState, {}),
      acceptAll,
      await this.ciphersuiteImpl,
    )
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
