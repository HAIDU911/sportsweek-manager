export type Role = 'Captain' | 'Scorer' | 'Admin'
export type FixtureStatus = 'Pending' | 'Scheduled' | 'Live' | 'InProgress' | 'Completed' | 'Bye' | 'Walkover' | 'DoubleForfeit' | 'Abandoned'

export interface Sport { id: number; name: string; rulesJson?: string }
export interface Tournament {
  id: number; name: string; status: string; registrationOpen: boolean; startAt?: string; endAt?: string
  thirdPlace?: boolean; sportId: number; sportName: string; teamCount: number; fixtureCount: number
}
export interface Team { id: number; name: string; department: string; section: string; tournamentId: number; tournamentName: string; sportName: string; status?: string; reviewReason?: string }
export interface Fixture {
  id: number; roundNo: number; slot: number; status: FixtureStatus; startsAt?: string; venue?: string
  homeScore?: number; awayScore?: number; outcome?: string; winnerTeamId?: number
  homeTeam?: string | null; awayTeam?: string | null; tournamentId?: number; tournamentName?: string; version?: number
}
export interface LeaderboardRow { department: string; wins: number; matchesPlayed: number; points: number; teams: number }
export interface Statistics { sportId: number; tournamentCount: number; teamCount: number; fixtureCount: number; completedMatches: number; scheduledMatches: number; pendingMatches: number; walkovers: number; draws: number }
export interface User { id: number; email: string; name: string; department: string; semester: number; enrollmentNo: string; section: string; emailVerified: boolean; role: Role }
export interface AuthSession { user: User; token: string }
export interface Notification { id: number; title: string; body: string; read: boolean; createdAt: string }
export interface RegenerationPreview { tournamentId: number; tournamentVersion: number; withdrawnTeamId: number; withdrawnTeamName: string; preservedWinnerIds: number[]; preservedWinnerNames: string[]; neverPlayedIds: number[]; neverPlayedNames: string[]; excludedTeamIds: number[]; excludedTeamNames: string[]; completedFixtureCount: number; newFixtureCount: number; message: string }
export interface RegenerationResult extends RegenerationPreview { createdFixtureIds: number[]; }
