import { Navigate, Route, Routes } from 'react-router-dom';

import HomeRoute from './routes/home';
import KittyDepositRoute from './routes/kitty-deposit';
import KittyDetailRoute from './routes/kitty-detail';
import KittyNewRoute from './routes/kitty-new';
import KittyProposeRoute from './routes/kitty-propose';

export default function App() {
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
