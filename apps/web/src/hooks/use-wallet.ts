import { useContext } from 'react';
import { WalletContext, type WalletContextValue } from '../components/wallet/WalletProvider';

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('useWallet must be used inside <WalletProvider>');
  }
  return ctx;
}
