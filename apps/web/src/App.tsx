import { Route, Routes } from 'react-router-dom';
import HomeRoute from './routes/home';

export default function App() {
  return (
    <div className="min-h-dvh">
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="*" element={<HomeRoute />} />
      </Routes>
    </div>
  );
}
