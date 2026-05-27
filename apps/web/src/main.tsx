import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';

import App from './App';
import { WalletProvider } from './components/wallet/WalletProvider';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root missing in index.html');
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <WalletProvider>
        <App />
        <Toaster theme="light" position="top-center" richColors closeButton />
      </WalletProvider>
    </BrowserRouter>
  </StrictMode>,
);
