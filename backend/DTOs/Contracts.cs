using System.ComponentModel.DataAnnotations;

namespace SportsWeekManager.DTOs;

public record RegisterRequest([Required, EmailAddress] string Email, [Required] string Name, [Required] string Department, [Range(1,16)] int Semester, [Required] string EnrollmentNo, [RegularExpression("^[AB]$")] string Section, [Required, MinLength(8)] string Password);
public record LoginRequest([Required, EmailAddress] string Email, [Required] string Password);
public record ResendVerificationRequest([Required, EmailAddress] string Email, [Required] string Password);
public record ForgotPasswordRequest([Required, EmailAddress] string Email);
public record ResetPasswordRequest([Required, EmailAddress] string Email, [Required] string Token, [Required, MinLength(8)] string Password);
public record ChangePasswordRequest([Required] string CurrentPassword, [Required, MinLength(8)] string NewPassword);
public record SportRequest([Required] string Name, object? Rules = null);
public record TournamentRequest(int SportId, string? Name, DateTime? StartAt, DateTime? EndAt, bool ThirdPlace, string? MatchStartTime, string? MatchEndTime, List<string>? AvailableDates, List<string>? VenueIds);
public record TournamentUpdateRequest(int SportId, string? Name, string? Status, bool RegistrationOpen, DateTime? StartAt, DateTime? EndAt, bool ThirdPlace, string? MatchStartTime, string? MatchEndTime, List<string>? AvailableDates, List<string>? VenueIds);
public record TeamRequest(string? Name, string? CaptainPhone, string? Section, List<int>? PlayerIds);
public record ReviewTeamRequest(string? Reason);
public record ScheduleRequest(DateTime StartsAt, [Required] string Venue, int ExpectedVersion = 1, bool Override = false);
public record AutoScheduleRequest(DateTime MatchStartTime, DateTime MatchEndTime, [Required, MinLength(1)] List<DateOnly> AvailableDates, [Required, MinLength(1)] List<string> Venues, int? DurationMinutes);
public record ScoreRequest([Range(0,int.MaxValue)] int HomeScore, [Range(0,int.MaxValue)] int AwayScore, int ExpectedVersion = 1, string Status = "Completed", string? Outcome = null);
public record RegenerateRequest(int WithdrawTeamId, int ExpectedVersion = 1, string Reason = "Team withdrawal");
public record ScoreCorrectionRequest([Range(0,int.MaxValue)] int HomeScore, [Range(0,int.MaxValue)] int AwayScore, int ExpectedVersion = 1, string Status = "Completed", string? Outcome = null, string? Reason = null);
