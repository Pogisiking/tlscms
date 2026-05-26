import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './stores/authStore';
import { MainLayout } from './components/layout/MainLayout';
import { LoginPage } from './pages/LoginPage';
import { MemberLoginPage } from './pages/MemberLoginPage';
import { MemberPortalPage } from './pages/MemberPortalPage';
import { DashboardPage } from './pages/DashboardPage';
import { MembersPage } from './pages/MembersPage';
import { LoansPage } from './pages/LoansPage';
import { ShareCapitalPage } from './pages/ShareCapitalPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProfileSettingsPage } from './pages/ProfileSettingsPage';
import { AuditTrailPage } from './pages/AuditTrailPage';
import { BackupPage } from './pages/BackupPage';
import { CutoffPage } from './pages/CutoffPage';
import { DividendsPage } from './pages/DividendsPage';
import { RouteRestore } from './RouteRestore';


function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, checkAuth, isLoading } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <MainLayout>{children}</MainLayout>;
}

function MemberRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('auth_token');
  const userData = localStorage.getItem('user_data');

  useEffect(() => {
    if (!token || !userData) {
      window.location.href = '/member-login';
      return;
    }

    try {
      const tokenData = JSON.parse(atob(token));
      if (tokenData.exp < Date.now() || tokenData.type !== 'member') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        window.location.href = '/member-login';
      }
    } catch {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
      window.location.href = '/member-login';
    }
  }, [token, userData]);

  if (!token || !userData) {
    return null;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Router>
      <RouteRestore />
      <Routes>

        {/* Admin Login */}
        <Route path="/login" element={<LoginPage />} />


        {/* Member Login */}
        <Route path="/member-login" element={<MemberLoginPage />} />

        {/* Member Portal */}
        <Route
          path="/portal"
          element={
            <MemberRoute>
              <MemberPortalPage />
            </MemberRoute>
          }
        />

        {/* Admin Routes */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <DashboardPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/members"
          element={
            <PrivateRoute>
              <MembersPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/share-capital"
          element={
            <PrivateRoute>
              <ShareCapitalPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/loans"
          element={
            <PrivateRoute>
              <LoansPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/cutoffs"
          element={
            <PrivateRoute>
              <CutoffPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/dividends"
          element={
            <PrivateRoute>
              <DividendsPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/reports"
          element={
            <PrivateRoute>
              <ReportsPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/audit"
          element={
            <PrivateRoute>
              <AuditTrailPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <PrivateRoute>
              <div className="p-6 lg:p-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
                <p className="text-gray-500 mt-2">Notification center coming soon.</p>
              </div>
            </PrivateRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <PrivateRoute>
              <SettingsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <ProfileSettingsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/backup"
          element={
            <PrivateRoute>
              <BackupPage />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
