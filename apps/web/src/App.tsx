import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { DrawerProvider } from './components/AppDrawer';
import AboutRoute from './routes/about';
import FundingRoute from './routes/funding';
import KittyDepositRoute from './routes/kitty-deposit';
import KittyDetailRoute from './routes/kitty-detail';
import KittyJoinRoute from './routes/kitty-join';
import KittyNewRoute from './routes/kitty-new';
import KittyProposeRoute from './routes/kitty-propose';
import PoolRoute from './routes/pool';
import ProviderProfileRoute from './routes/provider-profile';
import ServicesDetailRoute from './routes/services-detail';
import ServicesEditRoute from './routes/services-edit';
import ServicesMineRoute from './routes/services-mine';
import ServicesNewRoute from './routes/services-new';
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
    <DrawerProvider>
      <div className="min-h-dvh">
        <Routes>
        <Route path="/" element={<Navigate to="/services" replace />} />
        <Route path="/services" element={<ServicesRoute />} />
        <Route path="/services/new" element={<ServicesNewRoute />} />
        <Route path="/services/mine" element={<ServicesMineRoute />} />
        <Route path="/services/:id" element={<ServicesDetailRoute />} />
        <Route path="/services/:id/edit" element={<ServicesEditRoute />} />
        <Route path="/providers/:address" element={<ProviderProfileRoute />} />
        <Route path="/funding" element={<FundingRoute />} />
        <Route path="/kitty/new" element={<KittyNewRoute />} />
        <Route path="/kitty/:id" element={<KittyDetailRoute />} />
        <Route path="/kitty/:id/join" element={<KittyJoinRoute />} />
        <Route path="/kitty/:id/deposit" element={<KittyDepositRoute />} />
        <Route path="/kitty/:id/propose" element={<KittyProposeRoute />} />
        <Route path="/pool" element={<PoolRoute />} />
        <Route path="/stats" element={<StatsRoute />} />
        <Route path="/about" element={<AboutRoute />} />
        <Route path="*" element={<Navigate to="/services" replace />} />
        </Routes>
      </div>
    </DrawerProvider>
  );
}
