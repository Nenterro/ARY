import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Browse from './pages/Browse';
import Series from './pages/Series';
import Queue from './pages/Queue';
import Library from './pages/Library';
import Schedule from './pages/Schedule';
import Monitors from './pages/Monitors';
import Settings from './pages/Settings';
import { StatusProvider } from './context/StatusContext';

export default function App() {
  return (
    <StatusProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Browse />} />
            <Route path="series/:seriesId" element={<Series />} />
            <Route path="queue" element={<Queue />} />
            <Route path="library" element={<Library />} />
            <Route path="monitors" element={<Monitors />} />
            <Route path="schedule" element={<Schedule />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StatusProvider>
  );
}
