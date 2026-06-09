// Circles V2 deployment on Gnosis Chain (chainId 100).
// Source of truth: @aboutcircles/sdk-utils@0.1.31 → dist/config.js (kept in sync there).
// The "sandbox" addresses from the original spec are stale; the SDK only ships mainnet.

export type CirclesEnv = 'gnosis';

export interface CirclesConfig {
  env: CirclesEnv;
  chainId: number;
  rpcUrl: string;
  circlesRpcUrl: string;
  profileServiceUrl: string;
  v2HubAddress: `0x${string}`;
  nameRegistryAddress: `0x${string}`;
  baseGroupMintPolicy: `0x${string}`;
  baseGroupFactoryAddress: `0x${string}`;
  standardTreasury: `0x${string}`;
  liftERC20Address: `0x${string}`;
  /// Deployed by us, filled in once the KittyFactory deploy script has run.
  kittyFactoryAddress?: `0x${string}`;
  /// Singleton service directory deployed by us. Filled in via
  /// VITE_SERVICE_REGISTRY after `DeployServiceRegistry.s.sol`.
  serviceRegistryAddress?: `0x${string}`;
  /// Community pool Safe (Gnosis Chain) that receives the opt-in
  /// `poolShareBps` cut from every service payment. Legacy Safe path —
  /// the on-chain `RewardPool` in republish 5 (`rewardPoolAddress`) is
  /// the trustless replacement. Kept for read-only display until all
  /// services migrate to the pool route.
  communityPoolAddress: `0x${string}`;
  /// `BuyerActivity` contract (Republish 5). Public attestation log of
  /// "this address has paid ≥1 service via the Kitty". Read for the
  /// pool-eligibility badge; written via `markPaid()` in the PaySheet
  /// bundle right after the provider transfer.
  buyerActivityAddress?: `0x${string}`;
  /// `OpenMintPolicy` contract (Republish 5). Attached to the pool
  /// group avatar so any Circles V2 human with a non-zero
  /// `BuyerActivity` row can `groupMint` pool tokens. The front does
  /// not call this directly — Hub V2 invokes it during `groupMint` —
  /// but the address is exposed for debugging and verification.
  mintPolicyAddress?: `0x${string}`;
  /// `RewardPool` contract (Republish 5). This address is both the
  /// prize custodian AND the pool group avatar (`TheKittyPool` / `TKP`)
  /// registered on Hub V2. The PaySheet uses it as the group target
  /// for `groupMint`, and the winner UX uses it for `enterWeek` /
  /// `claim` / read-only views of the current week's draw.
  rewardPoolAddress?: `0x${string}`;
}

const GNOSIS: CirclesConfig = {
  env: 'gnosis',
  chainId: 100,
  rpcUrl: 'https://rpc.gnosischain.com',
  circlesRpcUrl: 'https://rpc.aboutcircles.com/',
  profileServiceUrl: 'https://rpc.aboutcircles.com/profiles/',
  v2HubAddress: '0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8',
  nameRegistryAddress: '0xA27566fD89162cC3D40Cb59c87AAaA49B85F3474',
  baseGroupMintPolicy: '0xcCa27c26CF7BAC2a9928f42201d48220F0e3a549',
  baseGroupFactoryAddress: '0xD0B5Bd9962197BEaC4cbA24244ec3587f19Bd06d',
  standardTreasury: '0x08F90aB73A515308f03A718257ff9887ED330C6e',
  liftERC20Address: '0x5F99a795dD2743C36D63511f0D4bc667e6d3cDB5',
  kittyFactoryAddress: (import.meta.env.VITE_KITTY_FACTORY as `0x${string}` | undefined) ?? undefined,
  serviceRegistryAddress:
    (import.meta.env.VITE_SERVICE_REGISTRY as `0x${string}` | undefined) ?? undefined,
  communityPoolAddress:
    (import.meta.env.VITE_COMMUNITY_POOL as `0x${string}` | undefined) ??
    '0x5A1773A01E403376c76B31dF63DF8D79dFDE8F11',
  buyerActivityAddress:
    (import.meta.env.VITE_BUYER_ACTIVITY as `0x${string}` | undefined) ??
    '0x99921C234d4Ca518DC58ba63ff9bfD2Cc9435f34',
  mintPolicyAddress:
    (import.meta.env.VITE_MINT_POLICY as `0x${string}` | undefined) ??
    '0x7D2a0C97324876F327281BBffFfE076Eaf3af84a',
  rewardPoolAddress:
    (import.meta.env.VITE_REWARD_POOL as `0x${string}` | undefined) ??
    '0x57CA75a98aC06De9708e29f239600eEC47Ca9888',
};

export const CIRCLES_CONFIG: CirclesConfig = GNOSIS;
