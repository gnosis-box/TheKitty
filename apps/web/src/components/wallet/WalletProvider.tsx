import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  isMiniappMode,
  onWalletChange,
  sendTransactions as sdkSendTransactions,
  signMessage as sdkSignMessage,
  type SignResult,
  type Transaction as MiniappTransaction,
} from '@aboutcircles/miniapp-sdk';

type Hex = `0x${string}`;

export interface WalletContextValue {
  address: Hex | null;
  isConnected: boolean;
  isMiniappHost: boolean;
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

  const value = useMemo<WalletContextValue>(
    () => ({
      address,
      isConnected: Boolean(address),
      isMiniappHost,
      sendTransactions: (txs) => sdkSendTransactions(txs),
      signMessage: (message) => sdkSignMessage(message),
    }),
    [address, isMiniappHost],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
