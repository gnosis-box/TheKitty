// Sources:
// - https://docs.aboutcircles.com/developer-docs/getting-started-with-the-sdk
// - https://github.com/aboutcircles/circles-contracts-v2
// Verify these addresses against the official docs before any deploy.

export type CirclesEnv = 'sandbox' | 'mainnet';

export interface CirclesConfig {
  env: CirclesEnv;
  circlesRpcUrl: string;
  pathfinderUrl: string;
  profileServiceUrl: string;
  v1HubAddress: `0x${string}`;
  v2HubAddress: `0x${string}`;
  migrationAddress: `0x${string}`;
  nameRegistryAddress: `0x${string}`;
  baseGroupMintPolicy: `0x${string}`;
  standardTreasury: `0x${string}`;
  chainId: number;
  rpcUrl: string;
}

const SANDBOX: CirclesConfig = {
  env: 'sandbox',
  circlesRpcUrl: 'https://static.94.138.251.148.clients.your-server.de/rpc/',
  pathfinderUrl: 'https://pathfinder.aboutcircles.com',
  profileServiceUrl: 'https://static.94.138.251.148.clients.your-server.de/profiles/',
  v1HubAddress: '0x29b9a7fbb8995b2423a71cc17cf9810798f6c543',
  v2HubAddress: '0x3D61f0A272eC69d65F5CFF097212079aaFDe8267',
  migrationAddress: '0x28141b6743c8569Ad8B20Ac09046Ba26F9Fb1c90',
  nameRegistryAddress: '0x8D1BEBbf5b8DFCef0F7E2039e4106A76Cb66f968',
  baseGroupMintPolicy: '0x79Cbc9C7077dF161b92a745345A6Ade3fC626A60',
  standardTreasury: '0x3545955Bc3900bda704261e4991f239BBd99ecE5',
  chainId: 100,
  rpcUrl: 'https://rpc.gnosischain.com',
};

const MAINNET: CirclesConfig = {
  ...SANDBOX,
  env: 'mainnet',
};

const requested = (import.meta.env.VITE_CIRCLES_ENV ?? 'sandbox') as CirclesEnv;
export const CIRCLES_CONFIG: CirclesConfig = requested === 'mainnet' ? MAINNET : SANDBOX;
