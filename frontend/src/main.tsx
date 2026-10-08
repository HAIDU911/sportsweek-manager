import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout, HomePage, SportsPage, TournamentsPage, TournamentPage, LeaderboardsPage, TeamsPage, LoginPage, RegisterPage, VerifyEmailPage, NotFoundPage } from './App'
import { currentSession } from './api'
import { CaptainWorkspace, AdminWorkspace, ScorerWorkspace } from './Workspaces'
import './styles.css'

export function AppRouter() {
  const [session, setSession] = useState(currentSession())
  useEffect(() => { const sync = () => setSession(currentSession()); window.addEventListener('sportsweek-auth', sync); return () => window.removeEventListener('sportsweek-auth', sync) }, [])
  return <Routes>
    <Route element={<Layout session={session} />}>
      <Route path="/" element={<HomePage />} />
      <Route path="/sports" element={<SportsPage />} />
      <Route path="/tournaments" element={<TournamentsPage />} />
      <Route path="/tournaments/:id" element={<TournamentPage />} />
      <Route path="/leaderboards" element={<LeaderboardsPage />} />
      <Route path="/teams" element={<TeamsPage />} />
      <Route path="/login" element={session ? <Navigate to={session.user.role === 'Captain' ? '/captain' : session.user.role === 'Admin' ? '/admin' : '/scorer'} replace /> : <LoginPage />} />
      <Route path="/register" element={session ? <Navigate to="/" replace /> : <RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/captain" element={session?.user.role === 'Captain' ? <CaptainWorkspace session={session} /> : <Navigate to="/login" replace />} />
      <Route path="/admin" element={session?.user.role === 'Admin' ? <AdminWorkspace session={session} /> : <Navigate to="/login" replace />} />
      <Route path="/scorer" element={session && (session.user.role === 'Scorer' || session.user.role === 'Admin') ? <ScorerWorkspace session={session} /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  </Routes>
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><AppRouter /></BrowserRouter></React.StrictMode>)
