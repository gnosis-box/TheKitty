import { Navigate, Route, Routes } from 'react-router-dom';

import HomeRoute from './routes/home';
import KittyDetailRoute from './routes/kitty-detail';
import KittyNewRoute from './routes/kitty-new';

export default function App() {
  return (
    <div className="min-h-dvh">
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/kitty/new" element={<KittyNewRoute />} />
        <Route path="/kitty/:id" element={<KittyDetailRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
