import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { BottomNav } from './components/layout/BottomNav';
import { CelebrationProvider } from './context/CelebrationContext';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { CardDetailScreen } from './screens/CardDetailScreen';
import { CollectionScreen } from './screens/CollectionScreen';
import { CreateEventScreen } from './screens/CreateEventScreen';
import { CreateRouteScreen } from './screens/CreateRouteScreen';
import { EventDetailScreen } from './screens/EventDetailScreen';
import { ExploreScreen } from './screens/ExploreScreen';
import { LoginScreen } from './screens/LoginScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { QuestsScreen } from './screens/QuestsScreen';
import { RewardsScreen } from './screens/RewardsScreen';
import { RouteDetailScreen } from './screens/RouteDetailScreen';
import { SocialScreen } from './screens/SocialScreen';
import { TradeComposerScreen } from './screens/TradeComposerScreen';

function AppShell() {
  const { player, loading } = usePlayer();
  if (loading) return <div className="flex h-full items-center justify-center text-5xl">🧭</div>;
  if (!player) return <LoginScreen />;
  return (
    <CelebrationProvider>
      <div className="mx-auto flex h-full max-w-3xl flex-col">
        <main className="relative min-h-0 flex-1">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </CelebrationProvider>
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
            <Route path="quests" element={<QuestsScreen />} />
            <Route path="events/new" element={<CreateEventScreen />} />
            <Route path="events/:id" element={<EventDetailScreen />} />
            <Route path="routes/new" element={<CreateRouteScreen />} />
            <Route path="routes/:id" element={<RouteDetailScreen />} />
            <Route path="rewards" element={<RewardsScreen />} />
            <Route path="social" element={<SocialScreen />} />
            <Route path="trade/:userId" element={<TradeComposerScreen />} />
            <Route path="profile" element={<ProfileScreen />} />
            <Route path="profile/:id" element={<ProfileScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </PlayerProvider>
  );
}
