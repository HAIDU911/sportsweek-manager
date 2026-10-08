import type { AuthSession, Fixture, LeaderboardRow, Notification, RegenerationPreview, RegenerationResult, Sport, Statistics, Team, Tournament, User } from './types'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5080').replace(/\/$/, '')
const ENABLE_DEMO_FALLBACK = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_FALLBACK === 'true'
const sessionKey = 'sportsweek-session'

const demoSports: Sport[] = [
  { id: 1, name: 'Futsal' }, { id: 2, name: 'Cricket' }, { id: 3, name: 'Basketball' },
  { id: 4, name: 'Badminton' }, { id: 5, name: 'Table Tennis' }, { id: 6, name: 'Chess' },
]
const demoTournaments: Tournament[] = [
  { id: 1, name: 'Futsal Open 2026', status: 'Scheduled', registrationOpen: false, startAt: '2026-10-12T08:00:00Z', endAt: '2026-10-17T18:00:00Z', sportId: 1, sportName: 'Futsal', teamCount: 16, fixtureCount: 15 },
  { id: 2, name: 'Inter-Department Cricket', status: 'RegistrationOpen', registrationOpen: true, startAt: '2026-10-13T08:00:00Z', endAt: '2026-10-18T18:00:00Z', sportId: 2, sportName: 'Cricket', teamCount: 8, fixtureCount: 0 },
  { id: 3, name: 'Badminton Singles', status: 'Live', registrationOpen: false, startAt: '2026-10-11T09:00:00Z', endAt: '2026-10-16T17:00:00Z', sportId: 4, sportName: 'Badminton', teamCount: 24, fixtureCount: 23 },
]
const demoTeams: Team[] = [
  { id: 1, name: 'The Strikers', department: 'Computer Science', section: 'A', tournamentId: 1, tournamentName: 'Futsal Open 2026', sportName: 'Futsal', status: 'Approved' },
  { id: 2, name: 'Blue Hawks', department: 'Electrical Engineering', section: 'B', tournamentId: 1, tournamentName: 'Futsal Open 2026', sportName: 'Futsal', status: 'Approved' },
  { id: 3, name: 'Net Ninjas', department: 'Business Administration', section: 'A', tournamentId: 3, tournamentName: 'Badminton Singles', sportName: 'Badminton', status: 'Approved' },
  { id: 4, name: 'Code Warriors', department: 'Software Engineering', section: 'C', tournamentId: 1, tournamentName: 'Futsal Open 2026', sportName: 'Futsal', status: 'Approved' },
]
const demoFixtures: Fixture[] = [
  { id: 101, roundNo: 1, slot: 1, status: 'Completed', startsAt: '2026-10-12T09:00:00Z', venue: 'Main Arena', homeScore: 3, awayScore: 2, homeTeam: 'The Strikers', awayTeam: 'Blue Hawks', outcome: 'home win', winnerTeamId: 1, version: 2 },
  { id: 102, roundNo: 1, slot: 2, status: 'Scheduled', startsAt: '2026-10-12T10:30:00Z', venue: 'Main Arena', homeTeam: 'Code Warriors', awayTeam: 'North Stars', version: 1 },
  { id: 103, roundNo: 2, slot: 1, status: 'Pending', homeTeam: 'Winner Match 1', awayTeam: 'Winner Match 2', version: 1 },
]
const demoLeaderboard: LeaderboardRow[] = [
  { department: 'Computer Science', wins: 8, matchesPlayed: 10, points: 24, teams: 3 },
  { department: 'Electrical Engineering', wins: 7, matchesPlayed: 11, points: 21, teams: 4 },
  { department: 'Business Administration', wins: 6, matchesPlayed: 9, points: 18, teams: 2 },
  { department: 'Software Engineering', wins: 5, matchesPlayed: 10, points: 15, teams: 3 },
]

function getSession(): AuthSession | null { try { return JSON.parse(sessionStorage.getItem(sessionKey) || 'null') } catch { return null } }
export function currentSession() { return getSession() }
export function saveSession(session: AuthSession | null) { if (session) sessionStorage.setItem(sessionKey, JSON.stringify(session)); else sessionStorage.removeItem(sessionKey); window.dispatchEvent(new Event('sportsweek-auth')) }

async function request<T>(path: string, init: RequestInit = {}, protectedCall = false): Promise<T> {
  const session = getSession()
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (protectedCall && session?.token) headers.set('Authorization', `Bearer ${session.token}`)
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.message || `Request failed (${response.status})`)
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

async function withDemo<T>(operation: () => Promise<T>, fallback: T): Promise<T> { try { return await operation() } catch (error) { if (ENABLE_DEMO_FALLBACK) return fallback; throw error } }
export const api = {
  publicSports: () => withDemo(() => request<Sport[]>('/api/public/sports'), demoSports),
  publicTeams: (sportId?: number) => withDemo(() => request<Team[]>(`/api/public/teams${sportId ? `?sportId=${sportId}` : ''}`), sportId ? demoTeams.filter(t => t.sportName === demoSports.find(s => s.id === sportId)?.name) : demoTeams),
  publicTournaments: () => withDemo(() => request<Tournament[]>('/api/public/tournaments'), demoTournaments),
  publicTournament: (id: number) => withDemo(() => request<Tournament>(`/api/public/tournaments/${id}`), demoTournaments.find(t => t.id === id) || demoTournaments[0]),
  publicFixtures: (id: number) => withDemo(() => request<Fixture[]>(`/api/public/tournaments/${id}/fixtures`), demoFixtures),
  publicLeaderboard: (sportId?: number) => withDemo(() => request<LeaderboardRow[]>(sportId ? `/api/public/leaderboards/${sportId}` : '/api/public/leaderboards/overall'), demoLeaderboard),
  publicStatistics: (sportId: number) => withDemo(() => request<Statistics>(`/api/public/statistics/${sportId}`), { sportId, tournamentCount: 2, teamCount: 16, fixtureCount: 23, completedMatches: 12, scheduledMatches: 4, pendingMatches: 7, walkovers: 1, draws: 0 }),
  login: (body: { email: string; password: string }) => request<{ user: User; token: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  register: (body: Record<string, unknown>) => request<{ user: User; emailVerified: boolean; message: string }>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  verifyEmail: (email: string, token: string) => request<{ message: string }>(`/api/auth/verify-email?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`),
  resendVerification: (body: { email: string; password: string }) => request<{ message: string }>('/api/auth/resend-verification', { method: 'POST', body: JSON.stringify(body) }),
  notifications: () => request<Notification[]>('/api/notifications', {}, true),
  captainTeams: () => request<Team[]>('/api/captain/teams', {}, true),
  captainFixtures: () => request<Fixture[]>('/api/captain/fixtures', {}, true),
  registerTeam: (tournamentId: number, body: Record<string, unknown>) => request(`/api/tournaments/${tournamentId}/teams`, { method: 'POST', body: JSON.stringify(body) }, true),
  tournaments: () => request<Tournament[]>('/api/tournaments', {}, true),
  adminDashboard: () => request<{ totalTeams: number; approvedTeams: number; pendingTeams: number; withdrawnTeams: number; tournaments: number; fixtures: number; completedFixtures: number }>('/api/admin/dashboard', {}, true),
  sports: () => request<Sport[]>('/api/sports', {}, true),
  createSport: (body: { name: string; rules?: unknown }) => request<Sport>('/api/sports', { method: 'POST', body: JSON.stringify(body) }, true),
  updateSport: (id: number, body: { name: string; rules?: unknown }) => request<Sport>(`/api/sports/${id}`, { method: 'PUT', body: JSON.stringify(body) }, true),
  updateTournament: (id: number, body: Record<string, unknown>) => request<Tournament>(`/api/tournaments/${id}`, { method: 'PUT', body: JSON.stringify(body) }, true),
  audit: () => request<Array<{ id: number; action: string; entityType: string; entityId?: number; detailsJson: string; createdAt: string }>>('/api/audit?limit=100', {}, true),
  adminTeams: (status?: string, tournamentId?: number) => request<Team[]>(`/api/admin/teams?${status ? `status=${encodeURIComponent(status)}&` : ''}${tournamentId ? `tournamentId=${tournamentId}` : ''}`, {}, true),
  createTournament: (body: Record<string, unknown>) => request<Tournament>('/api/tournaments', { method: 'POST', body: JSON.stringify(body) }, true),
  approveTeam: (id: number) => request(`/api/registrations/${id}/approve`, { method: 'POST' }, true),
  rejectTeam: (id: number, reason: string) => request(`/api/registrations/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }, true),
  generateFixtures: (id: number) => request<{ tournamentId: number; fixtureCount: number }>(`/api/tournaments/${id}/generate-fixtures`, { method: 'POST' }, true),
  fixtures: (id: number) => request<Fixture[]>(`/api/tournaments/${id}/fixtures`, {}, true),
  autoSchedule: (id: number, body: Record<string, unknown>) => request(`/api/tournaments/${id}/auto-schedule`, { method: 'POST', body: JSON.stringify(body) }, true),
  schedule: (id: number, body: Record<string, unknown>) => request(`/api/fixtures/${id}/schedule`, { method: 'POST', body: JSON.stringify(body) }, true),
  score: (id: number, body: Record<string, unknown>) => request(`/api/fixtures/${id}/score`, { method: 'POST', body: JSON.stringify(body) }, true),
  correctScore: (id: number, body: Record<string, unknown>) => request(`/api/fixtures/${id}/correct`, { method: 'POST', body: JSON.stringify(body) }, true),
  withdrawTeam: (id: number) => request(`/api/teams/${id}/withdraw`, { method: 'POST' }, true),
  regenerationPreview: (tournamentId: number, teamId: number) => request<RegenerationPreview>(`/api/tournaments/${tournamentId}/regenerate-fixtures/preview?withdrawTeamId=${teamId}`, {}, true),
  regenerateFixtures: (tournamentId: number, body: { withdrawTeamId: number; expectedVersion: number }) => request<RegenerationResult>(`/api/tournaments/${tournamentId}/regenerate-fixtures`, { method: 'POST', body: JSON.stringify(body) }, true),
}
