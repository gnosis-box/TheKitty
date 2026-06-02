import { sendTransactions as miniappSendTransactions } from '@aboutcircles/miniapp-sdk';
import type {
  Address,
  Hex,
  TransactionRequest,
} from '@aboutcircles/sdk-types';
import type { ContractRunner, BatchRun } from '@aboutcircles/sdk-runner';
import type { PublicClient, TransactionReceipt } from 'viem';

/// `ContractRunner` implementation that bridges the Circles SDK to the
/// miniapp iframe host. Reads go through a viem `PublicClient` (the host
/// is not a node); writes are forwarded to the host via `sendTransactions`
/// from `@aboutcircles/miniapp-sdk`, which bundles them into a single Safe
/// batch and asks the user to sign once.
///
/// Plug into the SDK like the canonical `SafeBrowserRunner`:
/// ```ts
/// const sdk = new Sdk(circlesConfig[100], new MiniappRunner(addr, publicClient));
/// const avatar = await sdk.getAvatar(addr);
/// await avatar.transfer.direct(provider, atto);
/// ```
///
/// Notes
/// - `sendTransaction(txs)` accepts an array, matching the SDK contract.
///   When called with N > 1 requests, all of them go in **one** host call →
///   one user signature → one atomic Safe batch on-chain.
/// - We return the **first** tx's receipt to the SDK (the Safe batch is a
///   single on-chain tx anyway, so all receipts in the host's reply alias
///   the same hash for our purposes).
/// - `address` is the viewer's Circles address as injected by the host.
/// - `init()` is a no-op: the host has already authenticated the user
///   before our app boots, so there's nothing to initialize.
export class MiniappRunner implements ContractRunner {
  public address: Address;
  public publicClient: PublicClient;

  constructor(address: Address, publicClient: PublicClient) {
    this.address = address;
    this.publicClient = publicClient;
  }

  async init(): Promise<void> {
    // no-op: identity is host-provided
  }

  /// Forward an array of `TransactionRequest` to the host, then wait for
  /// the receipt of the resulting Safe batch tx.
  async sendTransaction(txs: TransactionRequest[]): Promise<TransactionReceipt> {
    if (txs.length === 0) {
      throw new Error('MiniappRunner.sendTransaction: empty tx array');
    }
    const miniappTxs = txs.map((tx) => ({
      to: tx.to,
      data: tx.data,
      value: tx.value == null ? '0x0' : `0x${tx.value.toString(16)}`,
    }));
    const hashes = await miniappSendTransactions(miniappTxs);
    const hash = hashes[0];
    if (!hash) {
      throw new Error('MiniappRunner: host returned no transaction hash');
    }
    return this.publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
  }

  /// Read-only contract call via the public client.
  async call(tx: TransactionRequest): Promise<string> {
    const result = await this.publicClient.call({
      to: tx.to as `0x${string}`,
      data: tx.data as Hex,
      value: tx.value,
    });
    return result.data ?? '0x';
  }

  /// Gas estimate using the viewer as the implicit `from`.
  async estimateGas(tx: TransactionRequest): Promise<bigint> {
    return this.publicClient.estimateGas({
      account: this.address as `0x${string}`,
      to: tx.to as `0x${string}`,
      data: tx.data as Hex,
      value: tx.value,
    });
  }

  /// Open an interactive batch. Each `addTransaction(req)` accumulates;
  /// `run()` flushes the whole list through the host in a single signature.
  sendBatchTransaction(): BatchRun {
    return new MiniappBatchRun(this);
  }
}

/// Companion batch builder for callers that prefer the `addTransaction(...)`
/// → `run()` shape over passing a `TransactionRequest[]` directly. Internally
/// it just buffers requests and delegates to `MiniappRunner.sendTransaction`.
class MiniappBatchRun implements BatchRun {
  private readonly runner: MiniappRunner;
  private readonly buffer: TransactionRequest[] = [];

  constructor(runner: MiniappRunner) {
    this.runner = runner;
  }

  addTransaction(tx: TransactionRequest): void {
    this.buffer.push(tx);
  }

  async run(): Promise<TransactionReceipt> {
    return this.runner.sendTransaction(this.buffer);
  }
}
