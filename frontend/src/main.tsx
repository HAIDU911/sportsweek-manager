import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './styles.css';

import { useAuth } from './hooks/useAuth';
import { PublicLayout } from './layouts/PublicLayout';
import { UserLayout } from './layouts/UserLayout';
import { AdminLayout } from './layouts/AdminLayout';

import { HomePage } from './pages/public/HomePage';
import { SportsPage } from './pages/public/SportsPage';
import { TournamentsPage } from './pages/public/TournamentsPage';
import { TournamentDetailPage } from './pages/public/TournamentDetailPage';
import { LeaderboardsPage } from './pages/public/LeaderboardsPage';
import { TeamsPage } from './pages/public/TeamsPage';
import { SchedulePage } from './pages/public/SchedulePage';

import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';

import { ProfilePage } from './pages/user/ProfilePage';
import { NotificationsPage } from './pages/user/NotificationsPage';
import { CaptainDeskPage } from './pages/user/CaptainDeskPage';
import { ScorerDeskPage } from './pages/user/ScorerDeskPage';

import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { ManageTournamentsPage } from './pages/admin/ManageTournamentsPage';
import { ManageSportsPage } from './pages/admin/ManageSportsPage';
import { ManageTeamsPage } from './pages/admin/ManageTeamsPage';
import { ScoreCorrectionsPage } from './pages/admin/ScoreCorrectionsPage';

import { useNotifications } from './hooks/useNotifications';

const App: React.FC = () => {
  const { session, saveSession, clearSession } = useAuth();
  const { unread } = useNotifications(session);

  const handleLogin = (newSession: any) => saveSession(newSession);
  const handleLogout = () => clearSession();

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<PublicLayout><HomePage /></PublicLayout>} />
        <Route path="/sports" element={<PublicLayout><SportsPage /></PublicLayout>} />
        <Route path="/tournaments" element={<PublicLayout><TournamentsPage /></PublicLayout>} />
        <Route path="/tournaments/:id" element={<PublicLayout><TournamentDetailPage /></PublicLayout>} />
        <Route path="/leaderboards" element={<PublicLayout><LeaderboardsPage /></PublicLayout>} />
        <Route path="/teams" element={<PublicLayout><TeamsPage /></PublicLayout>} />
        <Route path="/schedule" element={<PublicLayout><SchedulePage /></PublicLayout>} />

        {/* Auth routes */}
        <Route path="/login" element={session ? <Navigate to="/" replace /> : <PublicLayout><LoginPage onLogin={handleLogin} /></PublicLayout>} />
        <Route path="/register" element={<PublicLayout><RegisterPage /></PublicLayout>} />
        <Route path="/verify-email" element={<PublicLayout><VerifyEmailPage /></PublicLayout>} />
        <Route path="/forgot-password" element={<PublicLayout><ForgotPasswordPage /></PublicLayout>} />
        <Route path="/reset-password" element={<PublicLayout><ResetPasswordPage /></PublicLayout>} />

        {/* User routes (authenticated) */}
        <Route path="/profile" element={session ? <UserLayout session={session} onLogout={handleLogout} unreadNotifications={unread}><ProfilePage session={session} /></UserLayout> : <Navigate to="/login" replace />} />
        <Route path="/notifications" element={session ? <UserLayout session={session} onLogout={handleLogout} unreadNotifications={unread}><NotificationsPage session={session} /></UserLayout> : <Navigate to="/login" replace />} />
        <Route path="/captain" element={session?.role === 'Captain' ? <UserLayout session={session} onLogout={handleLogout} unreadNotifications={unread}><CaptainDeskPage /></UserLayout> : <Navigate to="/" replace />} />
        <Route path="/scorer" element={session?.role === 'Scorer' ? <UserLayout session={session} onLogout={handleLogout} unreadNotifications={unread}><ScorerDeskPage /></UserLayout> : <Navigate to="/" replace />} />

        {/* Admin routes */}
        <Route path="/admin" element={session?.role === 'Admin' ? <AdminLayout session={session} onLogout={handleLogout} unreadNotifications={unread}><AdminDashboardPage /></AdminLayout> : <Navigate to="/" replace />} />
        <Route path="/admin/tournaments" element={session?.role === 'Admin' ? <AdminLayout session={session} onLogout={handleLogout} unreadNotifications={unread}><ManageTournamentsPage /></AdminLayout> : <Navigate to="/" replace />} />
        <Route path="/admin/sports" element={session?.role === 'Admin' ? <AdminLayout session={session} onLogout={handleLogout} unreadNotifications={unread}><ManageSportsPage /></AdminLayout> : <Navigate to="/" replace />} />
        <Route path="/admin/teams" element={session?.role === 'Admin' ? <AdminLayout session={session} onLogout={handleLogout} unreadNotifications={unread}><ManageTeamsPage /></AdminLayout> : <Navigate to="/" replace />} />
        <Route path="/admin/score-corrections" element={session?.role === 'Admin' ? <AdminLayout session={session} onLogout={handleLogout} unreadNotifications={unread}><ScoreCorrectionsPage /></AdminLayout> : <Navigate to="/" replace />} />

        {/* 404 */}
        <Route path="*" element={<PublicLayout><div className="error-state"><h1>404</h1><p>Page not found</p><a href="/">Go home</a></div></PublicLayout>} />
      </Routes>
    </BrowserRouter>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
