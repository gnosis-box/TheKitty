# `packages/runner/README.md` — section to add

Insert a new `### MiniappRunner` block after the existing `### SafeContractRunner` block, before the `## Features` section. Add the runner to the package's overview line too.

## Patch the Overview paragraph

> This package provides the `SafeContractRunner`, `SafeBrowserRunner`, **and `MiniappRunner`** implementations for executing transactions. `SafeContractRunner` covers server-side use with a private key, `SafeBrowserRunner` wraps an EIP-1193 wallet extension, and **`MiniappRunner` adapts the Circles miniapps iframe host's `sendTransactions` bridge to the SDK's `ContractRunner` interface so embedded mini-apps can use `core.hubV2.*` and the rest of the typed SDK without hand-rolling calldata**.

## New section

```markdown
### MiniappRunner

The `MiniappRunner` adapts the Circles miniapps host (`circles.gnosis.io/playground` or any other embedder) to the `ContractRunner` interface. Use it inside a mini-app, where the user's wallet lives in the parent frame and the host exposes a `sendTransactions(txs)` bridge instead of a direct EIP-1193 provider.

```typescript
import { createPublicClient, http } from 'viem';
import { gnosis } from 'viem/chains';
import {
  onWalletChange,
  sendTransactions,
} from '@aboutcircles/miniapp-sdk';
import { MiniappRunner } from '@aboutcircles/sdk-runner';
import { Sdk } from '@aboutcircles/sdk';
import { circlesConfig } from '@aboutcircles/sdk-utils';

const publicClient = createPublicClient({
  chain: gnosis,
  transport: http('https://rpc.gnosischain.com'),
});

onWalletChange(async (address) => {
  if (!address) return;
  const runner = new MiniappRunner(publicClient, sendTransactions, address);
  const sdk = new Sdk(circlesConfig[100], runner);

  // Every Circles primitive now goes through the typed SDK wrappers
  // — no hand-rolled calldata anywhere in your mini-app.
  const avatar = await sdk.getAvatar(address);
  await avatar.transfer.direct('0xRecipient', BigInt(1e18));
});
```

Like `SafeBrowserRunner`, `MiniappRunner` exposes a static `create()` factory if you prefer a one-step setup:

```typescript
import { chains, MiniappRunner } from '@aboutcircles/sdk-runner';
import { sendTransactions } from '@aboutcircles/miniapp-sdk';

const runner = await MiniappRunner.create(
  'https://rpc.gnosischain.com',
  sendTransactions,
  chains.gnosis,
  viewerAddress,
);
```

The `sendTransactions` function is passed in (not imported by `sdk-runner`) so this package stays free of a hard dependency on `@aboutcircles/miniapp-sdk` — that decoupling also makes the runner trivial to unit-test with a mock host.
```

## Patch the API section

Add to the list under `### ContractRunner Interface` and below `SafeContractRunner`:

```markdown
### MiniappRunner

```typescript
class MiniappRunner implements ContractRunner {
  constructor(
    publicClient: PublicClient,
    sendTransactions: MiniappSendTransactions,
    address?: Address,
  );

  static create(
    rpcUrl: string,
    sendTransactions: MiniappSendTransactions,
    chain: ChainLike,
    address?: Address,
  ): Promise<MiniappRunner>;

  init(address?: Address): Promise<void>;
  sendTransaction(txs: TransactionRequest[]): Promise<TransactionReceipt>;
  sendBatchTransaction(): MiniappBatchRun;
}
```
```
