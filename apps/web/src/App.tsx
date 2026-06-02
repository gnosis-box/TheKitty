import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import AboutRoute from './routes/about';
import FundingRoute from './routes/funding';
import KittyDepositRoute from './routes/kitty-deposit';
import KittyDetailRoute from './routes/kitty-detail';
import KittyJoinRoute from './routes/kitty-join';
import KittyNewRoute from './routes/kitty-new';
import KittyProposeRoute from './routes/kitty-propose';
import ServicesRoute from './routes/services';
import StatsRoute from './routes/stats';
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
        <Route path="/" element={<Navigate to="/services" replace />} />
        <Route path="/services" element={<ServicesRoute />} />
        <Route path="/funding" element={<FundingRoute />} />
        <Route path="/kitty/new" element={<KittyNewRoute />} />
        <Route path="/kitty/:id" element={<KittyDetailRoute />} />
        <Route path="/kitty/:id/join" element={<KittyJoinRoute />} />
        <Route path="/kitty/:id/deposit" element={<KittyDepositRoute />} />
        <Route path="/kitty/:id/propose" element={<KittyProposeRoute />} />
        <Route path="/stats" element={<StatsRoute />} />
        <Route path="/about" element={<AboutRoute />} />
        <Route path="*" element={<Navigate to="/services" replace />} />
      </Routes>
    </div>
  );
}
