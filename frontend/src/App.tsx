import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute, RootRedirect } from './components/auth/ProtectedRoute';
import { AdminLayout } from './components/layout/AdminLayout';
import { TraderLayout } from './components/layout/TraderLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminTraders } from './pages/admin/AdminTraders';
import { AdminTraderDetail } from './pages/admin/AdminTraderDetail';
import { AdminRequests } from './pages/admin/AdminRequests';
import { AdminBots } from './pages/admin/AdminBots';
import { AdminLogs } from './pages/admin/AdminLogs';
import { Dashboard } from './pages/Dashboard';
import { Bots } from './pages/Bots';
import { BotDetail } from './pages/BotDetail';
import { Wallets } from './pages/Wallets';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import { TraderLimitRequest } from './pages/trader/TraderLimitRequest';
import { useLenis } from './hooks/useLenis';

export function App(): JSX.Element {
  useLenis();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route path="/admin" element={<ProtectedRoute requiredRole="admin" />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="traders" element={<AdminTraders />} />
          <Route path="traders/:id" element={<AdminTraderDetail />} />
          <Route path="requests" element={<AdminRequests />} />
          <Route path="bots" element={<AdminBots />} />
          <Route path="logs" element={<AdminLogs />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>

      <Route path="/trader" element={<ProtectedRoute requiredRole="trader" />}>
        <Route element={<TraderLayout />}>
          <Route index element={<Navigate to="/trader/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="bots" element={<Bots />} />
          <Route path="bots/:id" element={<BotDetail />} />
          <Route path="wallets" element={<Wallets />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="limit" element={<TraderLimitRequest />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>

      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
