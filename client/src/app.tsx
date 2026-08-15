import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import Layout from './components/Layout';
import NotFound from './pages/NotFound/NotFound';
import LoginPage from './pages/LoginPage/LoginPage';
import OnboardingPage from './pages/OnboardingPage/OnboardingPage';
import MapPage from './pages/MapPage/MapPage';
import FriendsPage from './pages/FriendsPage/FriendsPage';
import ProfilePage from './pages/ProfilePage/ProfilePage';
import FriendDetailPage from './pages/FriendDetailPage/FriendDetailPage';
import ShortcutsPage from './pages/ShortcutsPage/ShortcutsPage';
import FakeCallPage from './pages/FakeCallPage/FakeCallPage';
import AddFriendPage from './pages/AddFriendPage/AddFriendPage';
import {
  getAuth,
  getOnboarding,
} from '@client/src/lib/storage';

/**
 * 需登录的路由包装：未登录跳 /login，首次登录跳 /onboarding
 */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = getAuth();
  const onboardingDone = getOnboarding();

  if (!auth) {
    return <Navigate to="/login" replace />;
  }
  if (!onboardingDone) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
};

/**
 * 登录页守卫：已登录用户直接跳 /map
 */
const LoginRoute: React.FC = () => {
  const auth = getAuth();
  if (auth) {
    return <Navigate to="/map" replace />;
  }
  return <LoginPage />;
};

/**
 * 引导页守卫：未登录跳 /login，已完成引导跳 /map
 */
const OnboardingRoute: React.FC = () => {
  const auth = getAuth();
  const onboardingDone = getOnboarding();
  if (!auth) {
    return <Navigate to="/login" replace />;
  }
  if (onboardingDone) {
    return <Navigate to="/map" replace />;
  }
  return <OnboardingPage />;
};

const RoutesComponent = () => {
  return (
    <Routes>
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/map" replace />} />
        <Route path="map" element={<MapPage />} />
        <Route path="friends" element={<FriendsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="friend/:id" element={<FriendDetailPage />} />
        <Route path="shortcuts" element={<ShortcutsPage />} />
        <Route path="fake-call" element={<FakeCallPage />} />
        <Route path="add-friend" element={<AddFriendPage />} />
      </Route>
      <Route path="login" element={<LoginRoute />} />
      <Route path="onboarding" element={<OnboardingRoute />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default RoutesComponent;
