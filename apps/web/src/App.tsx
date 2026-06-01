import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import HomeRoute from './routes/home';
import KittyDepositRoute from './routes/kitty-deposit';
import KittyDetailRoute from './routes/kitty-detail';
import KittyNewRoute from './routes/kitty-new';
import KittyProposeRoute from './routes/kitty-propose';
import { captureInviterFromUrl } from './lib/inviter';

export default function App() {
  // Capture `?via=<address>` once per page load, then strip it from the URL
  // so refreshes don't re-trigger and routing stays clean.
  useEffect(() => {
    captureInviterFromUrl();
  }, []);

  return (
    <div className="min-h-dvh">
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/kitty/new" element={<KittyNewRoute />} />
        <Route path="/kitty/:id" element={<KittyDetailRoute />} />
        <Route path="/kitty/:id/deposit" element={<KittyDepositRoute />} />
        <Route path="/kitty/:id/propose" element={<KittyProposeRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
