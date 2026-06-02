# Add `MiniappRunner` — `ContractRunner` for Circles miniapps iframe host

## Summary

This PR adds `MiniappRunner` to `@aboutcircles/sdk-runner`, alongside the existing `SafeContractRunner` and `SafeBrowserRunner`.

**Why**: mini-apps embedded in the Circles miniapps host (`circles.gnosis.io/playground` or any other embedder) cannot reach the user's wallet directly — the EIP-1193 provider lives in the parent frame. The host exposes a `sendTransactions(txs)` bridge over `postMessage` instead (see [`@aboutcircles/miniapp-sdk`](https://www.npmjs.com/package/@aboutcircles/miniapp-sdk)). Today this leaves miniapp authors with two unappealing options:

1. **Hand-roll calldata everywhere** with viem `encodeFunctionData(hubAbi, ...)` and forward to the host. Reinvents the typed wrappers shipped in `@aboutcircles/sdk-core`, drifts when ABIs evolve.
2. **Skip the SDK entirely** and treat Circles as a black box of opcodes. Forfeits everything the SDK family is designed to give them.

`MiniappRunner` closes the gap: it implements `ContractRunner` against the miniapp host's `sendTransactions`, so the rest of the SDK (`core.hubV2.*`, wrappers, avatar methods, `transfer.direct`, `transfer.advanced`, etc.) works inside a miniapp identically to how it works outside.

## What the runner does

- **Writes**: forwards `TransactionRequest[]` to the host's batch-send function. The host serialises them, batches them into a single Safe execution, asks the user to sign once, and returns one hash. The runner waits on `waitForTransactionReceipt` and returns viem's `TransactionReceipt` — same shape as `SafeBrowserRunner.sendTransaction`.
- **Reads**: delegates `estimateGas`, `call`, and `resolveName` to the `PublicClient` injected by the consumer (same pattern as `SafeBrowserRunner`).
- **Batching**: exposes `sendBatchTransaction()` that returns a `MiniappBatchRun`, mirroring `SafeBrowserBatchRun`. Callers can `addTransaction(...)` then `run()` to flush.
- **Error handling**: uses `RunnerError` consistently, throws `transactionReverted` on `receipt.status === 'reverted'`, throws `executionFailed` on host rejection or missing hash.

## What this PR doesn't add

- A hard dependency on `@aboutcircles/miniapp-sdk`. The consumer passes `sendTransactions` in at construction time — this keeps `sdk-runner` package-graph clean and makes the runner trivially mockable for tests.
- Changes to existing runners or the `ContractRunner` interface.

## API surface

```typescript
export interface MiniappHostTransaction {
  to: string;
  data?: string;
  value?: string;
}

export type MiniappSendTransactions = (
  txs: MiniappHostTransaction[],
) => Promise<string[]>;

export class MiniappRunner implements ContractRunner {
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

export class MiniappBatchRun implements BatchRun {
  addTransaction(tx: TransactionRequest): void;
  run(): Promise<TransactionReceipt>;
}
```

## Usage

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

  const avatar = await sdk.getAvatar(address);
  await avatar.transfer.direct('0xRecipient', BigInt(1e18));
});
```

Or the one-step factory:

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

## Production use

This runner ships in [The Kitty](https://thekitty.gnosis.box) — a Circles V2 mini-app for services + tontines, registered in [`gnosis-box/CirclesMiniapps`](https://github.com/gnosis-box/CirclesMiniapps). It has been live on Gnosis mainnet since cycle 3 of the Circles Garage program (June 2026), powering:

- single-signature `Hub.trust + Hub.safeTransferFrom + ServiceRegistry.logPayment` bundles in the services pay flow
- `KittyGovernance.smallSpend` from a group-pot kitty as an alternative pay source
- every `core.hubV2.*` call in the app's `tx-builders.ts`

Repo, contracts, and a 90-second demo: <https://github.com/gnosis-box/TheKitty>.

## Test plan

- [ ] `bun run build` in `packages/runner` succeeds and emits `dist/miniapp-runner.{js,d.ts}`.
- [ ] `index.ts` re-exports the new symbols (covered by the diff).
- [ ] Smoke test inside [The Kitty](https://thekitty.gnosis.box) — open the playground, publish a service, pay another wallet, confirm the bundled tx lands as a single Safe batch on Gnosis.

## Notes for reviewers

- The runner accepts `sendTransactions` as a constructor arg instead of importing it from `@aboutcircles/miniapp-sdk`. Happy to take a dependency on miniapp-sdk if the package maintainers prefer the symmetry with how `SafeBrowserRunner` takes `Eip1193Provider` directly — flagging because either way works and I went with the lighter-coupling option by default.
- I kept the JSDoc, naming, and class-field arrow-method style aligned with `safe-browser-runner.ts`. Open to renaming or trimming to match any internal conventions I missed.
- The package adds no new runtime dependencies. `@safe-global/protocol-kit` is unaffected.
