import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { BottomNav } from './components/layout/BottomNav';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { CardDetailScreen } from './screens/CardDetailScreen';
import { CollectionScreen } from './screens/CollectionScreen';
import { ExploreScreen } from './screens/ExploreScreen';
import { LoginScreen } from './screens/LoginScreen';
import { ProfileScreen } from './screens/ProfileScreen';

function AppShell() {
  const { player, loading } = usePlayer();
  if (loading) return <div className="flex h-full items-center justify-center text-5xl">🧭</div>;
  if (!player) return <LoginScreen />;
  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      <main className="relative min-h-0 flex-1">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <PlayerProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<ExploreScreen />} />
            <Route path="collection" element={<CollectionScreen />} />
            <Route path="card/:id" element={<CardDetailScreen />} />
            <Route path="profile" element={<ProfileScreen />} />
            <Route path="profile/:id" element={<ProfileScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </PlayerProvider>
  );
}
