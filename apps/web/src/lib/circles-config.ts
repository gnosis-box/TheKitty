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
};

export const CIRCLES_CONFIG: CirclesConfig = GNOSIS;
