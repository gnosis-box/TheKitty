import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  isMiniappMode,
  onWalletChange,
  sendTransactions as sdkSendTransactions,
  signMessage as sdkSignMessage,
  type SignResult,
  type Transaction as MiniappTransaction,
} from '@aboutcircles/miniapp-sdk';
import { Sdk } from '@aboutcircles/sdk';
import { circlesConfig } from '@aboutcircles/sdk-utils';

import { MiniappRunner } from '@/lib/miniapp-runner';
import { getPublicClient } from '@/lib/public-client';

type Hex = `0x${string}`;

export interface WalletContextValue {
  address: Hex | null;
  isConnected: boolean;
  isMiniappHost: boolean;
  /// Full Circles SDK bound to the viewer's address + host transactor.
  /// Null until the host injects an address. Use this for every Circles
  /// operation (transfer, trust, mint, profile reads); fall back to
  /// `sendTransactions` only for our own contracts (Kitty, ServiceRegistry).
  circlesSdk: Sdk | null;
  sendTransactions: (txs: MiniappTransaction[]) => Promise<string[]>;
  signMessage: (message: string) => Promise<SignResult>;
}

export type { MiniappTransaction };

export const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<Hex | null>(null);
  const isMiniappHost = useMemo(() => isMiniappMode(), []);

  useEffect(() => {
    const unsub = onWalletChange((addr) => {
      setAddress(addr ? (addr as Hex) : null);
    });
    return unsub;
  }, []);

  /// One SDK per connected viewer. Rebuilt whenever the host swaps the
  /// active address. Cheap to construct — no network calls in the runner
  /// or SDK constructors.
  const circlesSdk = useMemo<Sdk | null>(() => {
    if (!address) return null;
    const runner = new MiniappRunner(address, getPublicClient());
    return new Sdk(circlesConfig[100], runner);
  }, [address]);

  const value = useMemo<WalletContextValue>(
    () => ({
      address,
      isConnected: Boolean(address),
      isMiniappHost,
      circlesSdk,
      sendTransactions: (txs) => sdkSendTransactions(txs),
      signMessage: (message) => sdkSignMessage(message),
    }),
    [address, isMiniappHost, circlesSdk],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
