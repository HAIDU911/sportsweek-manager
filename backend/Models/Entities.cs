using System.ComponentModel.DataAnnotations;

namespace SportsWeekManager.Models;

public enum UserRole { Captain, Scorer, Admin }
public enum TeamStatus { Pending, Approved, Rejected, Withdrawn }
public enum FixtureStatus { Pending, Scheduled, Completed, Bye, Walkover, DoubleForfeit, Abandoned }

public class User
{
    public int Id { get; set; }
    [MaxLength(190)] public string Email { get; set; } = "";
    [MaxLength(160)] public string Name { get; set; } = "";
    [MaxLength(120)] public string Department { get; set; } = "";
    public int Semester { get; set; }
    [MaxLength(40)] public string EnrollmentNo { get; set; } = "";
    [MaxLength(1)] public string Section { get; set; } = "A";
    public bool EmailVerified { get; set; }
    [MaxLength(128)] public string? EmailVerificationTokenHash { get; set; }
    public DateTime? EmailVerificationExpiresAt { get; set; }
    public DateTime? EmailVerifiedAt { get; set; }
    [MaxLength(128)] public string? PasswordResetTokenHash { get; set; }
    public DateTime? PasswordResetExpiresAt { get; set; }
    public string PasswordHash { get; set; } = "";
    public UserRole Role { get; set; } = UserRole.Captain;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<Team> CaptainedTeams { get; set; } = new List<Team>();
    public ICollection<TeamPlayer> TeamPlayers { get; set; } = new List<TeamPlayer>();
}

public class Sport
{
    public int Id { get; set; }
    [MaxLength(100)] public string Name { get; set; } = "";
    public string RulesJson { get; set; } = "{}";
    public ICollection<Tournament> Tournaments { get; set; } = new List<Tournament>();
}

public class Tournament
{
    public int Id { get; set; }
    public int SportId { get; set; }
    public Sport? Sport { get; set; }
    [MaxLength(160)] public string Name { get; set; } = "";
    [MaxLength(40)] public string Status { get; set; } = "RegistrationOpen";
    public DateTime? StartAt { get; set; }
    public DateTime? EndAt { get; set; }
    public bool ThirdPlace { get; set; }
    public bool RegistrationOpen { get; set; } = true;
    [MaxLength(10)] public string? MatchStartTime { get; set; }
    [MaxLength(10)] public string? MatchEndTime { get; set; }
    public string AvailableDatesJson { get; set; } = "[]";
    public string VenueIdsJson { get; set; } = "[]";
    [ConcurrencyCheck] public int Version { get; set; } = 1;
    public ICollection<Team> Teams { get; set; } = new List<Team>();
    public ICollection<Fixture> Fixtures { get; set; } = new List<Fixture>();
}

public class Team
{
    public int Id { get; set; }
    public int TournamentId { get; set; }
    public Tournament? Tournament { get; set; }
    [MaxLength(160)] public string Name { get; set; } = "";
    [MaxLength(120)] public string Department { get; set; } = "";
    [MaxLength(1)] public string Section { get; set; } = "A";
    public int CaptainId { get; set; }
    public User? Captain { get; set; }
    [MaxLength(30)] public string CaptainPhone { get; set; } = "";
    public TeamStatus Status { get; set; } = TeamStatus.Pending;
    [MaxLength(500)] public string? ReviewReason { get; set; }
    public ICollection<TeamPlayer> Players { get; set; } = new List<TeamPlayer>();
}

public class TeamPlayer
{
    public int TeamId { get; set; }
    public Team? Team { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
}

public class Fixture
{
    public int Id { get; set; }
    public int TournamentId { get; set; }
    public Tournament? Tournament { get; set; }
    public int RoundNo { get; set; }
    public int Slot { get; set; }
    public int? HomeTeamId { get; set; }
    public int? AwayTeamId { get; set; }
    public int? HomeScore { get; set; }
    public int? AwayScore { get; set; }
    [MaxLength(40)] public string? Outcome { get; set; }
    public FixtureStatus Status { get; set; } = FixtureStatus.Pending;
    public int? WinnerTeamId { get; set; }
    [MaxLength(120)] public string? Venue { get; set; }
    public DateTime? StartsAt { get; set; }
    public int DurationMinutes { get; set; } = 60;
    public int Version { get; set; } = 1;
}

public class AuditEvent
{
    public long Id { get; set; }
    public int? ActorId { get; set; }
    [MaxLength(80)] public string Action { get; set; } = "";
    [MaxLength(80)] public string EntityType { get; set; } = "";
    public int? EntityId { get; set; }
    public string DetailsJson { get; set; } = "{}";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Notification
{
    public long Id { get; set; }
    public int UserId { get; set; }
    [MaxLength(160)] public string Title { get; set; } = "";
    public string Body { get; set; } = "";
    public bool Read { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
