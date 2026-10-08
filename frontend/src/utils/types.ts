export type Role = 'Captain' | 'Scorer' | 'Admin'
export type FixtureStatus = 'Pending' | 'Scheduled' | 'Live' | 'InProgress' | 'Completed' | 'Bye' | 'Walkover' | 'DoubleForfeit' | 'Abandoned'

export interface Sport { id: number; name: string; rulesJson?: string; tournamentCount?: number }
export interface Tournament {
  id: number; name: string; status: string; registrationOpen: boolean; startAt?: string; endAt?: string
  thirdPlace?: boolean; sportId: number; sportName: string; teamCount: number; fixtureCount: number
  completedFixtureCount?: number
  matchStartTime?: string | null; matchEndTime?: string | null
  availableDates?: string[]; venueIds?: string[]; version?: number
}
export interface TeamPlayerInfo { userId: number; name: string; department: string; section: string }
export interface Team {
  id: number; name: string; department: string; section: string; tournamentId: number; tournamentName: string; sportName: string
  status?: string; reviewReason?: string; captainPhone?: string; registrationOpen?: boolean; players?: TeamPlayerInfo[]
  captainName?: string; captainEmail?: string; playerCount?: number
}
export interface Fixture {
  id: number; roundNo: number; slot: number; status: FixtureStatus; startsAt?: string; venue?: string
  homeScore?: number; awayScore?: number; outcome?: string; winnerTeamId?: number
  homeTeam?: string | null; awayTeam?: string | null; homeTeamId?: number | null; awayTeamId?: number | null
  tournamentId?: number; tournamentName?: string; sportId?: number; sportName?: string; myTeamId?: number | null; version?: number
}
export interface PublicFixture extends Fixture { tournamentName: string; sportName: string; sportId: number }
export interface LeaderboardRow { department: string; wins: number; matchesPlayed: number; points: number; teams: number }
export interface Statistics { sportId: number; tournamentCount: number; teamCount: number; fixtureCount: number; completedMatches: number; scheduledMatches: number; pendingMatches: number; walkovers: number; draws: number }
export interface User { id: number; email: string; name: string; department: string; semester: number; enrollmentNo: string; section: string; emailVerified: boolean; role: Role }
export interface AuthSession { user: User; token: string }
export interface Notification { id: number; title: string; body: string; read: boolean; createdAt: string }
export interface UserSearchResult { id: number; name: string; department: string; enrollmentNo: string; section: string }
export interface DashboardSport { id: number; name: string; totalTeams: number; tournaments: number }
export interface DashboardData {
  totalTeams: number; approvedTeams: number; pendingTeams: number; rejectedTeams: number; withdrawnTeams: number
  tournaments: number; fixtures: number; completedFixtures: number; users: number; games: DashboardSport[]
}
export interface RegenerationPreview {
  tournamentId: number; tournamentVersion: number; withdrawnTeamId: number; withdrawnTeamName: string
  preservedWinnerIds: number[]; preservedWinnerNames: string[]; neverPlayedIds: number[]; neverPlayedNames: string[]
  excludedTeamIds: number[]; excludedTeamNames: string[]; completedFixtureCount: number; newFixtureCount: number; message: string
}
export interface RegenerationResult extends RegenerationPreview { createdFixtureIds: number[] }
