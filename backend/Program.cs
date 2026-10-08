using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SportsWeekManager.Data;
using SportsWeekManager.Domain;
using SportsWeekManager.DTOs;
using SportsWeekManager.Models;
using SportsWeekManager.Services;

var builder = WebApplication.CreateBuilder(args);
var configuration = builder.Configuration;
var jwtKey = configuration["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key is required");
if (jwtKey.Contains("CHANGE_ME", StringComparison.OrdinalIgnoreCase) && !builder.Environment.IsDevelopment()) throw new InvalidOperationException("Replace Jwt:Key before production");
var mysql = configuration.GetConnectionString("MySql") ?? throw new InvalidOperationException("ConnectionStrings:MySql is required");
var mysqlVersion = ServerVersion.Parse(configuration["MySql:ServerVersion"] ?? "8.0.0-mysql");
builder.Services.AddDbContext<AppDbContext>(o => o.UseMySql(mysql, mysqlVersion, mysqlOptions => mysqlOptions.EnableRetryOnFailure(5)));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o => o.TokenValidationParameters = new TokenValidationParameters { ValidateIssuerSigningKey=true, IssuerSigningKey=new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)), ValidateIssuer=true, ValidIssuer=configuration["Jwt:Issuer"], ValidateAudience=true, ValidAudience=configuration["Jwt:Audience"], ValidateLifetime=true, ClockSkew=TimeSpan.FromMinutes(1) });
builder.Services.AddAuthorization();
builder.Services.AddSingleton<IEmailSender, GmailEmailSender>();
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(configuration.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:3000"]).AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddRateLimiter(o => { o.RejectionStatusCode = StatusCodes.Status429TooManyRequests; o.AddFixedWindowLimiter("auth", w => { w.Window = TimeSpan.FromMinutes(1); w.PermitLimit = 20; w.QueueLimit = 0; }); });
var app = builder.Build();

if (app.Environment.IsDevelopment()) { app.UseSwagger(); app.UseSwaggerUI(); }
app.Use(async (context, next) => { context.Response.Headers["X-Content-Type-Options"]="nosniff"; context.Response.Headers["X-Frame-Options"]="DENY"; context.Response.Headers["Referrer-Policy"]="strict-origin-when-cross-origin"; await next(); });
app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

if (Environment.GetEnvironmentVariable("SKIP_DB_INIT") != "true")
{
    using var scope = app.Services.CreateScope();
    try { var db=scope.ServiceProvider.GetRequiredService<AppDbContext>(); await db.Database.EnsureCreatedAsync(); if (configuration.GetValue("Seed:Enabled", true)) await SeedAsync(db, app.Logger); }
    catch (Exception ex) { scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Startup").LogWarning(ex, "MySQL initialization was skipped because the configured server is unavailable."); }
}

app.MapGet("/health", () => Results.Ok(new { status="ok", service="sportsweek-manager-api-dotnet", time=DateTime.UtcNow }));
app.MapGet("/health/ready", async (AppDbContext db) => { try { using var timeout=new CancellationTokenSource(TimeSpan.FromSeconds(3)); var database=await db.Database.CanConnectAsync(timeout.Token); return database ? Results.Ok(new { status="ready", database=true }) : Results.Json(new { status="not_ready", database=false }, statusCode:503); } catch { return Results.Json(new { status="not_ready", database=false }, statusCode:503); } });

// ---------------------------------------------------------------- authentication
app.MapPost("/api/auth/register", async (RegisterRequest request, AppDbContext db, IEmailSender email) =>
{
    if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length < 2) return Results.BadRequest(new { message="Full name must contain at least 2 characters." });
    if (request.Semester is < 1 or > 8) return Results.BadRequest(new { message="Semester must be between 1 and 8." });
    if (string.IsNullOrWhiteSpace(request.Department) || string.IsNullOrWhiteSpace(request.EnrollmentNo) || string.IsNullOrWhiteSpace(request.Section)) return Results.BadRequest(new { message="Department, enrollment number, and section are required." });
    if (request.Section is not ("A" or "B")) return Results.BadRequest(new { message="Section must be A or B." });
    if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 8) return Results.BadRequest(new { message="Password must be at least 8 characters." });
    if (!IsGmailAddress(request.Email)) return Results.BadRequest(new { message="Only Gmail/Google Mail addresses are allowed (example@gmail.com). You must verify ownership from the email link." });
    if (!email.IsConfigured) return Results.Json(new { code="email_delivery_unavailable", message="Email verification is temporarily unavailable. Configure the Gmail SMTP sender before registering captains." }, statusCode: StatusCodes.Status503ServiceUnavailable);
    if (await db.Users.AnyAsync(x => x.Email == request.Email.Trim().ToLowerInvariant() || x.EnrollmentNo == request.EnrollmentNo.Trim())) return Results.Conflict(new { message="Email or enrollment number already exists" });
    var verificationToken=CreateVerificationToken();
    var user=new User { Email=request.Email.Trim().ToLowerInvariant(), Name=request.Name.Trim(), Department=request.Department.Trim(), Semester=request.Semester, EnrollmentNo=request.EnrollmentNo.Trim(), Section=request.Section, PasswordHash=BCrypt.Net.BCrypt.HashPassword(request.Password), EmailVerificationTokenHash=HashToken(verificationToken), EmailVerificationExpiresAt=DateTime.UtcNow.AddHours(24) };
    db.Users.Add(user); await db.SaveChangesAsync();
    var verificationUrl=$"{configuration["Email:VerificationBaseUrl"]}?email={Uri.EscapeDataString(user.Email)}&token={Uri.EscapeDataString(verificationToken)}";
    try { await email.SendAsync(user.Email,"Verify your SportsWeek Manager email",$"<p>Hello {System.Net.WebUtility.HtmlEncode(user.Name)},</p><p>Verify your Gmail address to register a team and receive match/result emails:</p><p><a href=\"{verificationUrl}\">Verify my email</a></p><p>This link expires in 24 hours.</p>"); } catch(Exception ex) { app.Logger.LogError(ex,"Verification email failed for {Email}",user.Email); return Results.Json(new { code="email_delivery_failed", message="The account was created, but the verification email could not be delivered. Sign in and use “Resend verification” once the email service is available." }, statusCode: StatusCodes.Status502BadGateway); }
    return Results.Ok(new { user=PublicUser(user), emailVerified=false, message="Verification email sent. Confirm your Gmail address before registering a team." });
}).AllowAnonymous().RequireRateLimiting("auth");

app.MapPost("/api/auth/login", async (LoginRequest request, AppDbContext db) =>
{
    var user=await db.Users.SingleOrDefaultAsync(x=>x.Email==request.Email.Trim().ToLowerInvariant());
    if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password,user.PasswordHash)) return Results.Unauthorized();
    return Results.Ok(new { user=PublicUser(user), emailVerified=user.EmailVerified, token=CreateToken(user,configuration,jwtKey) });
}).AllowAnonymous().RequireRateLimiting("auth");

app.MapGet("/api/auth/verify-email", async (string email, string token, AppDbContext db) =>
{
    var user=await db.Users.SingleOrDefaultAsync(x=>x.Email==email.Trim().ToLowerInvariant());
    if(user is null || user.EmailVerificationExpiresAt < DateTime.UtcNow || user.EmailVerificationTokenHash is null || !CryptographicOperations.FixedTimeEquals(Convert.FromHexString(user.EmailVerificationTokenHash),Convert.FromHexString(HashToken(token)))) return Results.BadRequest(new { message="Verification link is invalid or expired" });
    user.EmailVerified=true; user.EmailVerifiedAt=DateTime.UtcNow; user.EmailVerificationTokenHash=null; user.EmailVerificationExpiresAt=null; await db.SaveChangesAsync(); return Results.Ok(new { message="Email verified. You may now register a team." });
}).AllowAnonymous();

app.MapPost("/api/auth/resend-verification", async (ResendVerificationRequest request, AppDbContext db, IEmailSender email) =>
{
    var user=await db.Users.SingleOrDefaultAsync(x=>x.Email==request.Email.Trim().ToLowerInvariant());
    if(user is null || !BCrypt.Net.BCrypt.Verify(request.Password,user.PasswordHash)) return Results.Unauthorized();
    if(user.EmailVerified) return Results.BadRequest(new { message="Email is already verified" });
    if (!email.IsConfigured) return Results.Json(new { code="email_delivery_unavailable", message="Email verification is temporarily unavailable. Configure the Gmail SMTP sender before requesting another link." }, statusCode: StatusCodes.Status503ServiceUnavailable);
    var token=CreateVerificationToken(); user.EmailVerificationTokenHash=HashToken(token); user.EmailVerificationExpiresAt=DateTime.UtcNow.AddHours(24); await db.SaveChangesAsync(); var url=$"{configuration["Email:VerificationBaseUrl"]}?email={Uri.EscapeDataString(user.Email)}&token={Uri.EscapeDataString(token)}"; try { await email.SendAsync(user.Email,"Verify your SportsWeek Manager email",$"<p><a href=\"{url}\">Verify my email</a></p>"); } catch { return Results.Json(new { code="email_delivery_failed", message="The verification email could not be delivered. Try again after the email service is available." }, statusCode: StatusCodes.Status502BadGateway); } return Results.Ok(new { message="Verification email sent" });
}).AllowAnonymous().RequireRateLimiting("auth");

app.MapPost("/api/auth/forgot-password", async (ForgotPasswordRequest request, AppDbContext db, IEmailSender email) =>
{
    if (!email.IsConfigured) return Results.Json(new { code="email_delivery_unavailable", message="Password reset is temporarily unavailable because the email service is not configured." }, statusCode: StatusCodes.Status503ServiceUnavailable);
    var user=await db.Users.SingleOrDefaultAsync(x=>x.Email==request.Email.Trim().ToLowerInvariant());
    if (user is not null)
    {
        var token=CreateVerificationToken(); user.PasswordResetTokenHash=HashToken(token); user.PasswordResetExpiresAt=DateTime.UtcNow.AddHours(1); await db.SaveChangesAsync();
        var resetUrl=$"{ResetPasswordBaseUrl(configuration)}?email={Uri.EscapeDataString(user.Email)}&token={Uri.EscapeDataString(token)}";
        try { await email.SendAsync(user.Email,"Reset your SportsWeek Manager password",$"<p>Hello {System.Net.WebUtility.HtmlEncode(user.Name)},</p><p>Use the link below to choose a new password. It expires in 1 hour:</p><p><a href=\"{resetUrl}\">Reset my password</a></p><p>If you did not request this, you can safely ignore this email.</p>"); } catch(Exception ex) { app.Logger.LogError(ex,"Password reset email failed for {Email}",user.Email); }
    }
    return Results.Ok(new { message="If that address is registered, a password reset link has been sent. Check the inbox and spam folder." });
}).AllowAnonymous().RequireRateLimiting("auth");

app.MapPost("/api/auth/reset-password", async (ResetPasswordRequest request, AppDbContext db) =>
{
    if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 8) return Results.BadRequest(new { message="Password must be at least 8 characters." });
    var user=await db.Users.SingleOrDefaultAsync(x=>x.Email==request.Email.Trim().ToLowerInvariant());
    if(user is null || user.PasswordResetTokenHash is null || user.PasswordResetExpiresAt < DateTime.UtcNow) return Results.BadRequest(new { message="Reset link is invalid or expired. Request a new one." });
    try { if(!CryptographicOperations.FixedTimeEquals(Convert.FromHexString(user.PasswordResetTokenHash),Convert.FromHexString(HashToken(request.Token??"")))) return Results.BadRequest(new { message="Reset link is invalid or expired. Request a new one." }); }
    catch { return Results.BadRequest(new { message="Reset link is invalid or expired. Request a new one." }); }
    user.PasswordHash=BCrypt.Net.BCrypt.HashPassword(request.Password); user.PasswordResetTokenHash=null; user.PasswordResetExpiresAt=null; await db.SaveChangesAsync();
    return Results.Ok(new { message="Password updated. Sign in with your new password." });
}).AllowAnonymous().RequireRateLimiting("auth");

// ---------------------------------------------------------------- public portal
app.MapGet("/api/public/sports", async (AppDbContext db) => Results.Ok(await db.Sports.OrderBy(x=>x.Name).Select(x=>new { x.Id,x.Name,x.RulesJson,TournamentCount=x.Tournaments.Count }).ToListAsync())).AllowAnonymous();
app.MapGet("/api/public/teams", async (int? sportId, AppDbContext db) =>
{
    var q=db.Teams.Include(x=>x.Tournament).ThenInclude(x=>x!.Sport).Where(x=>x.Status==TeamStatus.Approved).AsQueryable(); if(sportId.HasValue) q=q.Where(x=>x.Tournament!.SportId==sportId.Value);
    return Results.Ok(await q.Select(x=>new { x.Id,x.Name,x.Department,x.Section,TournamentId=x.TournamentId,TournamentName=x.Tournament!.Name,SportName=x.Tournament!.Sport!.Name }).ToListAsync());
}).AllowAnonymous();
app.MapGet("/api/public/tournaments", async (AppDbContext db) => Results.Ok(await db.Tournaments.Include(x=>x.Sport).OrderByDescending(x=>x.Id).Select(x=>new { x.Id,x.Name,x.Status,x.RegistrationOpen,x.StartAt,x.EndAt,x.ThirdPlace,x.SportId,SportName=x.Sport!.Name,TeamCount=x.Teams.Count(t=>t.Status==TeamStatus.Approved),FixtureCount=x.Fixtures.Count,CompletedFixtureCount=x.Fixtures.Count(f=>f.Status==FixtureStatus.Completed||f.Status==FixtureStatus.Walkover||f.Status==FixtureStatus.DoubleForfeit||f.Status==FixtureStatus.Abandoned) }).ToListAsync())).AllowAnonymous();
app.MapGet("/api/public/tournaments/{tid:int}", async (int tid, AppDbContext db) => { var t=await db.Tournaments.Include(x=>x.Sport).SingleOrDefaultAsync(x=>x.Id==tid); return t is null?Results.NotFound():Results.Ok(new { t.Id,t.Name,t.Status,t.RegistrationOpen,t.StartAt,t.EndAt,t.ThirdPlace,t.SportId,SportName=t.Sport!.Name,TeamCount=await db.Teams.CountAsync(x=>x.TournamentId==tid&&x.Status==TeamStatus.Approved),FixtureCount=await db.Fixtures.CountAsync(x=>x.TournamentId==tid),CompletedFixtureCount=await db.Fixtures.CountAsync(x=>x.TournamentId==tid&&(x.Status==FixtureStatus.Completed||x.Status==FixtureStatus.Walkover||x.Status==FixtureStatus.DoubleForfeit||x.Status==FixtureStatus.Abandoned)) }); }).AllowAnonymous();
app.MapGet("/api/public/tournaments/{tid:int}/fixtures", async (int tid, AppDbContext db) => { var fixtures=await db.Fixtures.Where(x=>x.TournamentId==tid).OrderBy(x=>x.RoundNo).ThenBy(x=>x.Slot).ToListAsync(); var names=await TeamNamesAsync(db,fixtures); return Results.Ok(fixtures.Select(x=>new { x.Id,x.TournamentId,x.RoundNo,x.Slot,x.Status,x.StartsAt,x.Venue,x.HomeScore,x.AwayScore,x.Outcome,x.WinnerTeamId,HomeTeam=TeamName(names,x.HomeTeamId),AwayTeam=TeamName(names,x.AwayTeamId) })); }).AllowAnonymous();
app.MapGet("/api/public/fixtures", async (int? sportId, string? filter, int? limit, AppDbContext db) =>
{
    var mode=(filter??"upcoming").Trim().ToLowerInvariant();
    var query=db.Fixtures.Include(x=>x.Tournament).ThenInclude(x=>x!.Sport).AsQueryable();
    if(sportId.HasValue) query=query.Where(x=>x.Tournament!.SportId==sportId.Value);
    query=mode=="results"
        ? query.Where(x=>x.Status==FixtureStatus.Completed||x.Status==FixtureStatus.Walkover||x.Status==FixtureStatus.DoubleForfeit||x.Status==FixtureStatus.Abandoned).OrderByDescending(x=>x.StartsAt).ThenByDescending(x=>x.Id)
        : query.Where(x=>x.Status==FixtureStatus.Scheduled||x.Status==FixtureStatus.Pending||x.Status==FixtureStatus.Bye).OrderBy(x=>x.StartsAt==null).ThenBy(x=>x.StartsAt).ThenBy(x=>x.RoundNo).ThenBy(x=>x.Slot);
    var fixtures=await query.Take(Math.Clamp(limit??60,1,200)).ToListAsync();
    var names=await TeamNamesAsync(db,fixtures);
    return Results.Ok(fixtures.Select(x=>new { x.Id,x.TournamentId,TournamentName=x.Tournament!.Name,SportId=x.Tournament.SportId,SportName=x.Tournament.Sport!.Name,x.RoundNo,x.Slot,Status=x.Status.ToString(),x.StartsAt,x.Venue,x.HomeScore,x.AwayScore,x.Outcome,x.WinnerTeamId,HomeTeam=TeamName(names,x.HomeTeamId),AwayTeam=TeamName(names,x.AwayTeamId) }));
}).AllowAnonymous();
app.MapGet("/api/public/leaderboards/{sportId:int}", async (int sportId, AppDbContext db) => Results.Ok(await PublicLeaderboardAsync(db,sportId))).AllowAnonymous();
app.MapGet("/api/public/leaderboards/overall", async (AppDbContext db) => Results.Ok(await PublicLeaderboardAsync(db,null))).AllowAnonymous();
app.MapGet("/api/public/statistics/{sportId:int}", async (int sportId, AppDbContext db) => { var tournaments=await db.Tournaments.Where(x=>x.SportId==sportId).Select(x=>x.Id).ToListAsync(); var fixtures=await db.Fixtures.Where(x=>tournaments.Contains(x.TournamentId)).ToListAsync(); return Results.Ok(new { sportId,TournamentCount=tournaments.Count,TeamCount=await db.Teams.CountAsync(x=>tournaments.Contains(x.TournamentId)&&x.Status==TeamStatus.Approved),FixtureCount=fixtures.Count,CompletedMatches=fixtures.Count(x=>x.Status==FixtureStatus.Completed),ScheduledMatches=fixtures.Count(x=>x.Status==FixtureStatus.Scheduled),PendingMatches=fixtures.Count(x=>x.Status==FixtureStatus.Pending),Walkovers=fixtures.Count(x=>x.Status==FixtureStatus.Walkover),Draws=fixtures.Count(x=>string.Equals(x.Outcome,"draw",StringComparison.OrdinalIgnoreCase)) }); }).AllowAnonymous();

// ---------------------------------------------------------------- authenticated operations
var auth=app.MapGroup("/api").RequireAuthorization();
auth.MapGet("/sports", async (AppDbContext db) => Results.Ok(await db.Sports.OrderBy(x=>x.Name).Select(x=>new { x.Id,x.Name,x.RulesJson,TournamentCount=x.Tournaments.Count }).ToListAsync()));
auth.MapPost("/sports", async (SportRequest request, ClaimsPrincipal claims, AppDbContext db) => { if(!IsRole(claims,UserRole.Admin)) return Results.Forbid(); var name=request.Name?.Trim()??""; if(name.Length<2) return Results.BadRequest(new { message="Sport name must contain at least 2 characters." }); if(await db.Sports.AnyAsync(x=>x.Name==name)) return Results.Conflict(new { message="A sport with this name already exists" }); var sport=new Sport{Name=name,RulesJson=request.Rules is null?"{}":JsonSerializer.Serialize(request.Rules)}; db.Sports.Add(sport); await db.SaveChangesAsync(); await Audit(db,claims,"create","sport",sport.Id,new { sport.Name }); return Results.Ok(sport); });
auth.MapPut("/sports/{id:int}", async (int id, SportRequest request, ClaimsPrincipal claims, AppDbContext db) => { if(!IsRole(claims,UserRole.Admin)) return Results.Forbid(); var sport=await db.Sports.FindAsync(id); if(sport is null) return Results.NotFound(); var name=request.Name?.Trim()??""; if(name.Length<2) return Results.BadRequest(new { message="Sport name must contain at least 2 characters." }); if(await db.Sports.AnyAsync(x=>x.Name==name&&x.Id!=id)) return Results.Conflict(new { message="A sport with this name already exists" }); sport.Name=name; sport.RulesJson=request.Rules is null?sport.RulesJson:JsonSerializer.Serialize(request.Rules); await db.SaveChangesAsync(); await Audit(db,claims,"update","sport",id,request); return Results.Ok(sport); });
auth.MapDelete("/sports/{id:int}", async (int id, ClaimsPrincipal claims, AppDbContext db) => { if(!IsRole(claims,UserRole.Admin)) return Results.Forbid(); var sport=await db.Sports.FindAsync(id); if(sport is null) return Results.NotFound(); if(await db.Tournaments.AnyAsync(x=>x.SportId==id)) return Results.Conflict(new { message="This sport still has tournaments. Delete or reassign them first." }); db.Sports.Remove(sport); await db.SaveChangesAsync(); await Audit(db,claims,"delete","sport",id,new { sport.Name }); return Results.Ok(new { deleted=true,id }); });

auth.MapGet("/tournaments", async (AppDbContext db) =>
{
    var rows=await db.Tournaments.Include(x=>x.Sport).OrderByDescending(x=>x.Id).Select(x=>new { x.Id,x.Name,x.Status,x.RegistrationOpen,x.SportId,SportName=x.Sport!.Name,x.StartAt,x.EndAt,x.ThirdPlace,x.MatchStartTime,x.MatchEndTime,x.AvailableDatesJson,x.VenueIdsJson,x.Version,TeamCount=x.Teams.Count(t=>t.Status==TeamStatus.Approved),FixtureCount=x.Fixtures.Count,CompletedFixtureCount=x.Fixtures.Count(f=>f.Status==FixtureStatus.Completed||f.Status==FixtureStatus.Walkover||f.Status==FixtureStatus.DoubleForfeit||f.Status==FixtureStatus.Abandoned) }).ToListAsync();
    return Results.Ok(rows.Select(x=>new { x.Id,x.Name,x.Status,x.RegistrationOpen,x.SportId,x.SportName,x.StartAt,x.EndAt,x.ThirdPlace,x.MatchStartTime,x.MatchEndTime,x.Version,x.TeamCount,x.FixtureCount,x.CompletedFixtureCount,AvailableDates=ParseStringList(x.AvailableDatesJson),VenueIds=ParseStringList(x.VenueIdsJson) }));
});
auth.MapPost("/tournaments", async (TournamentRequest request, ClaimsPrincipal claims, AppDbContext db) =>
{
    if(!IsRole(claims,UserRole.Admin)) return Results.Forbid();
    var name=request.Name?.Trim()??""; if(name.Length<2) return Results.BadRequest(new{message="Tournament name must contain at least 2 characters."});
    if(!await db.Sports.AnyAsync(x=>x.Id==request.SportId)) return Results.NotFound(new { message="Sport not found" });
    if(request.StartAt.HasValue&&request.EndAt.HasValue&&request.EndAt.Value<request.StartAt.Value) return Results.BadRequest(new{message="End date cannot be before the start date."});
    var t=new Tournament { SportId=request.SportId,Name=name,StartAt=request.StartAt,EndAt=request.EndAt,ThirdPlace=request.ThirdPlace,MatchStartTime=request.MatchStartTime,MatchEndTime=request.MatchEndTime,AvailableDatesJson=JsonSerializer.Serialize(request.AvailableDates??[]),VenueIdsJson=JsonSerializer.Serialize(request.VenueIds??[]) };
    db.Tournaments.Add(t); await db.SaveChangesAsync(); await Audit(db,claims,"create","tournament",t.Id,request); return Results.Ok(t);
});
auth.MapPut("/tournaments/{id:int}", async (int id, TournamentUpdateRequest request, ClaimsPrincipal claims, AppDbContext db) =>
{
    if(!IsRole(claims,UserRole.Admin)) return Results.Forbid();
    var t=await db.Tournaments.FindAsync(id); if(t is null) return Results.NotFound();
    if(!await db.Sports.AnyAsync(x=>x.Id==request.SportId)) return Results.NotFound(new { message="Sport not found" });
    if(request.SportId!=t.SportId&&(await db.Teams.AnyAsync(x=>x.TournamentId==id)||await db.Fixtures.AnyAsync(x=>x.TournamentId==id))) return Results.Conflict(new { message="The sport cannot be changed after teams or fixtures exist." });
    var name=request.Name?.Trim(); if(!string.IsNullOrWhiteSpace(name)){ if(name.Length<2) return Results.BadRequest(new{message="Tournament name must contain at least 2 characters."}); t.Name=name; }
    if(!string.IsNullOrWhiteSpace(request.Status)) t.Status=request.Status.Trim();
    t.SportId=request.SportId; t.RegistrationOpen=request.RegistrationOpen; t.ThirdPlace=request.ThirdPlace;
    if(request.StartAt.HasValue) t.StartAt=request.StartAt;
    if(request.EndAt.HasValue) t.EndAt=request.EndAt;
    if(t.StartAt.HasValue&&t.EndAt.HasValue&&t.EndAt.Value<t.StartAt.Value) return Results.BadRequest(new{message="End date cannot be before the start date."});
    if(request.MatchStartTime is not null) t.MatchStartTime=string.IsNullOrWhiteSpace(request.MatchStartTime)?null:request.MatchStartTime.Trim();
    if(request.MatchEndTime is not null) t.MatchEndTime=string.IsNullOrWhiteSpace(request.MatchEndTime)?null:request.MatchEndTime.Trim();
    if(request.AvailableDates is not null) t.AvailableDatesJson=JsonSerializer.Serialize(request.AvailableDates);
    if(request.VenueIds is not null) t.VenueIdsJson=JsonSerializer.Serialize(request.VenueIds);
    t.Version++; await db.SaveChangesAsync(); await Audit(db,claims,"update","tournament",id,request); return Results.Ok(t);
});
auth.MapDelete("/tournaments/{id:int}", async (int id, ClaimsPrincipal claims, AppDbContext db) => { if(!IsRole(claims,UserRole.Admin)) return Results.Forbid(); var t=await db.Tournaments.FindAsync(id); if(t is null) return Results.NotFound(); if(await db.Teams.AnyAsync(x=>x.TournamentId==id)||await db.Fixtures.AnyAsync(x=>x.TournamentId==id)) return Results.Conflict(new { message="Delete is only allowed before any team or fixture exists." }); db.Tournaments.Remove(t); await db.SaveChangesAsync(); await Audit(db,claims,"delete","tournament",id,new { t.Name }); return Results.Ok(new { deleted=true,id }); });
auth.MapGet("/leaderboards/{sportId:int}", async (int sportId, AppDbContext db) => Results.Ok(await PublicLeaderboardAsync(db,sportId)));
auth.MapGet("/leaderboards/overall", async (AppDbContext db) => Results.Ok(await PublicLeaderboardAsync(db,null)));
auth.MapGet("/notifications", async (ClaimsPrincipal claims, AppDbContext db) => { var id=UserId(claims); return Results.Ok(await db.Notifications.Where(x=>x.UserId==id).OrderByDescending(x=>x.Id).Take(100).ToListAsync()); });
auth.MapPost("/notifications/{id:long}/read", async (long id, ClaimsPrincipal claims, AppDbContext db) => { var uid=UserId(claims); var n=await db.Notifications.SingleOrDefaultAsync(x=>x.Id==id&&x.UserId==uid); if(n is null) return Results.NotFound(); n.Read=true; await db.SaveChangesAsync(); return Results.Ok(new { id=n.Id, read=true }); });
auth.MapPost("/notifications/read-all", async (ClaimsPrincipal claims, AppDbContext db) => { var uid=UserId(claims); await db.Notifications.Where(x=>x.UserId==uid&&!x.Read).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.Read,true)); return Results.Ok(new { updated=true }); });
auth.MapPost("/auth/change-password", async (ChangePasswordRequest request, ClaimsPrincipal claims, AppDbContext db) =>
{
    var user=await db.Users.FindAsync(UserId(claims)); if(user is null) return Results.Unauthorized();
    if(!BCrypt.Net.BCrypt.Verify(request.CurrentPassword??"",user.PasswordHash)) return Results.BadRequest(new { message="Current password is incorrect." });
    if(string.IsNullOrWhiteSpace(request.NewPassword)||request.NewPassword.Length<8) return Results.BadRequest(new { message="New password must be at least 8 characters." });
    user.PasswordHash=BCrypt.Net.BCrypt.HashPassword(request.NewPassword); await db.SaveChangesAsync(); await Audit(db,claims,"change-password","user",user.Id,new{}); return Results.Ok(new { message="Password updated." });
});
auth.MapGet("/users/search", async (string? q, int? tournamentId, ClaimsPrincipal claims, AppDbContext db) =>
{
    if(!IsRole(claims,UserRole.Admin,UserRole.Captain)) return Results.Forbid();
    var term=(q??"").Trim(); if(term.Length<2) return Results.Ok(Array.Empty<object>());
    var query=db.Users.Where(x=>x.EmailVerified&&(x.Name.Contains(term)||x.EnrollmentNo.Contains(term)));
    if(tournamentId.HasValue){ var taken=db.TeamPlayers.Where(t=>t.Team!.TournamentId==tournamentId.Value).Select(t=>t.UserId); query=query.Where(x=>!taken.Contains(x.Id)); }
    return Results.Ok(await query.OrderBy(x=>x.Name).Take(10).Select(x=>new { x.Id,x.Name,x.Department,x.EnrollmentNo,x.Section }).ToListAsync());
});
auth.MapGet("/captain/teams", async (ClaimsPrincipal claims, AppDbContext db) =>
{
    if(!IsRole(claims,UserRole.Captain)) return Results.Forbid(); var id=UserId(claims);
    var teams=await db.Teams.Include(x=>x.Tournament).ThenInclude(x=>x!.Sport).Include(x=>x.Players).ThenInclude(x=>x.User).Where(x=>x.CaptainId==id).OrderByDescending(x=>x.Id).ToListAsync();
    return Results.Ok(teams.Select(x=>new { x.Id,x.Name,x.Department,x.Section,Status=x.Status.ToString(),x.ReviewReason,x.CaptainPhone,TournamentId=x.TournamentId,TournamentName=x.Tournament!.Name,SportName=x.Tournament.Sport!.Name,RegistrationOpen=x.Tournament.RegistrationOpen,Players=x.Players.Where(p=>p.User is not null).Select(p=>new { UserId=p.UserId,Name=p.User!.Name,Department=p.User.Department,Section=p.User.Section }).OrderBy(p=>p.Name).ToList() }));
});
auth.MapGet("/captain/fixtures", async (ClaimsPrincipal claims, AppDbContext db) =>
{
    if(!IsRole(claims,UserRole.Captain)) return Results.Forbid(); var id=UserId(claims);
    var teamIds=await db.Teams.Where(x=>x.CaptainId==id).Select(x=>x.Id).ToListAsync();
    var fixtures=await db.Fixtures.Where(x=>x.HomeTeamId.HasValue&&x.AwayTeamId.HasValue&&(teamIds.Contains(x.HomeTeamId.Value)||teamIds.Contains(x.AwayTeamId.Value))).Include(x=>x.Tournament).ThenInclude(x=>x!.Sport).OrderBy(x=>x.StartsAt==null).ThenBy(x=>x.StartsAt).ThenBy(x=>x.RoundNo).ToListAsync();
    var names=await TeamNamesAsync(db,fixtures);
    return Results.Ok(fixtures.Select(x=>new { x.Id,x.TournamentId,TournamentName=x.Tournament!.Name,SportName=x.Tournament.Sport!.Name,x.RoundNo,x.Slot,Status=x.Status.ToString(),x.StartsAt,x.Venue,x.HomeScore,x.AwayScore,x.Outcome,x.WinnerTeamId,x.Version,x.HomeTeamId,x.AwayTeamId,HomeTeam=TeamName(names,x.HomeTeamId),AwayTeam=TeamName(names,x.AwayTeamId),MyTeamId=teamIds.Contains(x.HomeTeamId??0)?x.HomeTeamId:x.AwayTeamId }));
});
auth.MapGet("/admin/teams", async (string? status, int? tournamentId, ClaimsPrincipal claims, AppDbContext db) => { if(!IsRole(claims,UserRole.Admin)) return Results.Forbid(); var query=db.Teams.Include(x=>x.Tournament).ThenInclude(x=>x!.Sport).Include(x=>x.Captain).AsQueryable(); if(tournamentId.HasValue) query=query.Where(x=>x.TournamentId==tournamentId.Value); if(Enum.TryParse<TeamStatus>(status,true,out var parsed)) query=query.Where(x=>x.Status==parsed); return Results.Ok(await query.OrderBy(x=>x.Status).ThenBy(x=>x.Id).Select(x=>new { x.Id,x.Name,x.Department,x.Section,Status=x.Status.ToString(),x.ReviewReason,x.CaptainPhone,x.CaptainId,CaptainName=x.Captain!.Name,CaptainEmail=x.Captain!.Email,TournamentId=x.TournamentId,TournamentName=x.Tournament!.Name,SportName=x.Tournament!.Sport!.Name,PlayerCount=x.Players.Count }).ToListAsync()); });
auth.MapGet("/admin/dashboard", async (ClaimsPrincipal claims, AppDbContext db) => { if(!IsRole(claims,UserRole.Admin)) return Results.Forbid(); return Results.Ok(new { totalTeams=await db.Teams.CountAsync(), approvedTeams=await db.Teams.CountAsync(x=>x.Status==TeamStatus.Approved), pendingTeams=await db.Teams.CountAsync(x=>x.Status==TeamStatus.Pending), rejectedTeams=await db.Teams.CountAsync(x=>x.Status==TeamStatus.Rejected), withdrawnTeams=await db.Teams.CountAsync(x=>x.Status==TeamStatus.Withdrawn), tournaments=await db.Tournaments.CountAsync(), fixtures=await db.Fixtures.CountAsync(), completedFixtures=await db.Fixtures.CountAsync(x=>x.Status==FixtureStatus.Completed), users=await db.Users.CountAsync(x=>x.Role==UserRole.Captain), games=await db.Sports.Select(s=>new { s.Id,s.Name,TotalTeams=db.Teams.Count(t=>t.Tournament!.SportId==s.Id&&t.Status==TeamStatus.Approved),Tournaments=db.Tournaments.Count(t=>t.SportId==s.Id) }).ToListAsync() }); });

// ---------------------------------------------------------------- registrations & review
auth.MapPost("/tournaments/{tid:int}/teams", async (int tid, TeamRequest request, ClaimsPrincipal claims, AppDbContext db) =>
{
    if(!IsRole(claims,UserRole.Captain)) return Results.Forbid();
    var user=await db.Users.FindAsync(UserId(claims)); var t=await db.Tournaments.FindAsync(tid);
    if(user is null||t is null||!t.RegistrationOpen) return Results.NotFound(new { message="Tournament is not open for registration" });
    if(!user.EmailVerified) return Results.BadRequest(new { message="Verify your Gmail address before registering a team" });
    var name=request.Name?.Trim()??"";
    if(name.Length<2) return Results.BadRequest(new { message="Team name must contain at least 2 characters." });
    if(name.Length>160) return Results.BadRequest(new { message="Team name must be 160 characters or fewer." });
    if(string.IsNullOrWhiteSpace(request.CaptainPhone)||request.CaptainPhone.Trim().Length<7) return Results.BadRequest(new { message="A valid captain phone number is required." });
    if(request.Section is not ("A" or "B")) return Results.BadRequest(new { message="Section must be A or B." });
    if(await db.Teams.AnyAsync(x=>x.TournamentId==tid&&x.Name==name)) return Results.Conflict(new { message="Team name already exists" });
    var playerProblem=await ValidatePlayerIdsAsync(db,tid,user.Id,request.PlayerIds,null); if(playerProblem is not null) return Results.Conflict(new { message=playerProblem });
    var team=new Team { TournamentId=tid,Name=name,Department=user.Department,Section=request.Section,CaptainId=user.Id,CaptainPhone=request.CaptainPhone.Trim() };
    db.Teams.Add(team); await db.SaveChangesAsync();
    foreach(var pid in (request.PlayerIds??[]).Append(user.Id).Distinct()) db.TeamPlayers.Add(new TeamPlayer{TeamId=team.Id,UserId=pid});
    await db.SaveChangesAsync();
    await Audit(db,claims,"register-team","team",team.Id,new{team.Name,tournament=t.Name});
    await NotifyAdminsAsync(db,"New team registration",$"{team.Name} ({user.Department}) was submitted for {t.Name}. Review it from the admin desk.");
    return Results.Ok(team);
});
auth.MapPut("/captain/teams/{teamId:int}", async (int teamId, TeamRequest request, ClaimsPrincipal claims, AppDbContext db) =>
{
    if(!IsRole(claims,UserRole.Captain)) return Results.Forbid();
    var user=await db.Users.FindAsync(UserId(claims));
    var team=await db.Teams.Include(x=>x.Players).Include(x=>x.Tournament).SingleOrDefaultAsync(x=>x.Id==teamId);
    if(user is null||team is null) return Results.NotFound();
    if(team.CaptainId!=user.Id) return Results.Forbid();
    if(team.Status is not (TeamStatus.Pending or TeamStatus.Rejected)) return Results.Conflict(new { message="Only pending or rejected registrations can be edited. Contact the sports committee about approved teams." });
    var name=request.Name?.Trim()??"";
    if(name.Length<2) return Results.BadRequest(new { message="Team name must contain at least 2 characters." });
    if(string.IsNullOrWhiteSpace(request.CaptainPhone)||request.CaptainPhone.Trim().Length<7) return Results.BadRequest(new { message="A valid captain phone number is required." });
    if(request.Section is not ("A" or "B")) return Results.BadRequest(new { message="Section must be A or B." });
    if(await db.Teams.AnyAsync(x=>x.TournamentId==team.TournamentId&&x.Id!=team.Id&&x.Name==name)) return Results.Conflict(new { message="Team name already exists" });
    var playerProblem=await ValidatePlayerIdsAsync(db,team.TournamentId,user.Id,request.PlayerIds,team.Id); if(playerProblem is not null) return Results.Conflict(new { message=playerProblem });
    var resubmitted=team.Status==TeamStatus.Rejected;
    team.Name=name; team.CaptainPhone=request.CaptainPhone.Trim(); team.Section=request.Section; team.Status=TeamStatus.Pending; team.ReviewReason=null;
    db.TeamPlayers.RemoveRange(team.Players);
    foreach(var pid in (request.PlayerIds??[]).Append(user.Id).Distinct()) db.TeamPlayers.Add(new TeamPlayer{TeamId=team.Id,UserId=pid});
    await db.SaveChangesAsync();
    await Audit(db,claims,resubmitted?"resubmit-team":"update-team","team",team.Id,new{team.Name,resubmitted});
    if(resubmitted) await NotifyAdminsAsync(db,"Team registration updated",$"{team.Name} was corrected and resubmitted by the captain. Review it again.");
    return Results.Ok(new { team.Id, team.Name, Status=team.Status.ToString() });
});
auth.MapPost("/registrations/{teamId:int}/approve", async (int teamId, ClaimsPrincipal claims, AppDbContext db) =>
{
    if(!IsRole(claims,UserRole.Admin)) return Results.Forbid(); var t=await db.Teams.Include(x=>x.Tournament).SingleOrDefaultAsync(x=>x.Id==teamId); if(t is null)return Results.NotFound();
    if(t.Status==TeamStatus.Approved) return Results.Conflict(new { message="This team is already approved." });
    if(t.Status==TeamStatus.Withdrawn) return Results.Conflict(new { message="A withdrawn team cannot be re-approved. Use the withdrawal/regeneration workflow instead." });
    t.Status=TeamStatus.Approved; t.ReviewReason=null; await db.SaveChangesAsync(); await Audit(db,claims,"approve","team",teamId,new{});
    await NotifyAsync(db,[t.CaptainId],"Team approved",$"{t.Name} is approved for {t.Tournament?.Name ?? "the tournament"}. Fixtures will appear on your captain desk once scheduled.");
    return Results.Ok(new { status=t.Status.ToString(),teamId });
});
auth.MapPost("/registrations/{teamId:int}/reject", async (int teamId, ReviewTeamRequest request, ClaimsPrincipal claims, AppDbContext db) =>
{
    if(!IsRole(claims,UserRole.Admin)) return Results.Forbid(); var t=await db.Teams.Include(x=>x.Tournament).SingleOrDefaultAsync(x=>x.Id==teamId); if(t is null)return Results.NotFound();
    if(t.Status!=TeamStatus.Pending)return Results.Conflict(new { message="Only pending registrations can be rejected" });
    t.Status=TeamStatus.Rejected; t.ReviewReason=string.IsNullOrWhiteSpace(request.Reason)?"Registration requires correction":request.Reason.Trim(); await db.SaveChangesAsync(); await Audit(db,claims,"reject","team",teamId,request);
    await NotifyAsync(db,[t.CaptainId],"Registration needs correction",$"{t.Name} was not approved: {t.ReviewReason} Open “My registrations”, fix the details and resubmit.");
    return Results.Ok(new { status=t.Status.ToString(),teamId,reason=t.ReviewReason });
});

// ---------------------------------------------------------------- fixtures & scheduling
auth.MapPost("/tournaments/{tid:int}/generate-fixtures", async (int tid, ClaimsPrincipal claims, AppDbContext db) =>
{
    if(!IsRole(claims,UserRole.Admin)) return Results.Forbid(); var t=await db.Tournaments.FindAsync(tid); if(t is null)return Results.NotFound(); if(await db.Fixtures.AnyAsync(x=>x.TournamentId==tid&&new[]{FixtureStatus.Completed,FixtureStatus.Walkover,FixtureStatus.DoubleForfeit,FixtureStatus.Abandoned}.Contains(x.Status))) return Results.Conflict(new{message="Fixtures cannot be regenerated after historical matches exist. Use the withdrawal/regeneration workflow to preserve history."}); var ids=await db.Teams.Where(x=>x.TournamentId==tid&&x.Status==TeamStatus.Approved).OrderBy(x=>x.Id).Select(x=>x.Id).ToListAsync(); if(ids.Count<2)return Results.BadRequest(new{message="At least two approved teams are required"}); db.Fixtures.RemoveRange(db.Fixtures.Where(x=>x.TournamentId==tid)); var created=new List<Fixture>(); foreach(var p in TournamentEngine.GenerateBracket(ids)){var fixture=new Fixture{TournamentId=tid,RoundNo=p.RoundNo,Slot=p.Slot,HomeTeamId=p.Home,AwayTeamId=p.Away,Status=p.Bye?FixtureStatus.Bye:FixtureStatus.Pending,WinnerTeamId=p.Bye?(p.Home??p.Away):null}; db.Fixtures.Add(fixture); created.Add(fixture);} PropagateByes(created); t.Status="Scheduled";t.RegistrationOpen=false;t.Version++; await db.SaveChangesAsync(); await Audit(db,claims,"generate-fixtures","tournament",tid,new{teamCount=ids.Count}); return Results.Ok(new{tournamentId=tid,fixtureCount=await db.Fixtures.CountAsync(x=>x.TournamentId==tid)});
});
auth.MapGet("/tournaments/{tid:int}/fixtures", async(int tid, AppDbContext db)=>{var fixtures=await db.Fixtures.Where(x=>x.TournamentId==tid).OrderBy(x=>x.RoundNo).ThenBy(x=>x.Slot).ToListAsync();var names=await TeamNamesAsync(db,fixtures);return Results.Ok(fixtures.Select(x=>new{x.Id,x.TournamentId,x.RoundNo,x.Slot,x.Status,x.StartsAt,x.Venue,x.HomeScore,x.AwayScore,x.Outcome,x.WinnerTeamId,x.Version,HomeTeam=TeamName(names,x.HomeTeamId),AwayTeam=TeamName(names,x.AwayTeamId)}));});
auth.MapPost("/tournaments/{tid:int}/auto-schedule", async(int tid, AutoScheduleRequest request, ClaimsPrincipal claims, AppDbContext db, IEmailSender email)=>
{
    if(!IsRole(claims,UserRole.Admin))return Results.Forbid(); var t=await db.Tournaments.Include(x=>x.Sport).SingleOrDefaultAsync(x=>x.Id==tid); if(t is null)return Results.NotFound(); var pending=await db.Fixtures.Where(x=>x.TournamentId==tid&&new[]{FixtureStatus.Pending,FixtureStatus.Scheduled}.Contains(x.Status)&&x.HomeTeamId!=null&&x.AwayTeamId!=null).OrderBy(x=>x.RoundNo).ThenBy(x=>x.Slot).ToListAsync(); if(pending.Count==0)return Results.BadRequest(new{message="No fixtures with both teams assigned are waiting to be scheduled."}); var rules=JsonSerializer.Deserialize<JsonElement>(t.Sport!.RulesJson); var duration=request.DurationMinutes??(rules.TryGetProperty("durationMinutes",out var d)?d.GetInt32():60); if(duration<5||duration>480)return Results.BadRequest(new{message="Match duration must be between 5 and 480 minutes."}); List<ScheduleAssignment> assignments; try{assignments=TournamentEngine.BuildSchedule(pending.Select(x=>(x.Id,x.DurationMinutes)),request.MatchStartTime,request.MatchEndTime,request.AvailableDates,request.Venues,duration);}catch(ArgumentException e){return Results.BadRequest(new{message=e.Message});} foreach(var a in assignments){var f=pending.Single(x=>x.Id==a.FixtureId);f.StartsAt=a.StartsAt;f.Venue=a.Venue;f.DurationMinutes=duration;f.Status=FixtureStatus.Scheduled;f.Version++;} await db.SaveChangesAsync(); foreach(var a in assignments){var f=pending.Single(x=>x.Id==a.FixtureId);if(f.HomeTeamId.HasValue&&f.AwayTeamId.HasValue)await NotifyCaptainsOfTeamsAsync(db,new[]{f.HomeTeamId.Value,f.AwayTeamId.Value},"Match scheduled",$"{t.Name}: your next match is on {a.StartsAt:ddd dd MMM, HH:mm} at {a.Venue}.");await SendFixtureEmailAsync(db,email,a.FixtureId,"Upcoming SportsWeek match",true);} await Audit(db,claims,"auto-schedule","tournament",tid,new{scheduled=assignments.Count,duration}); return Results.Ok(new{scheduled=assignments.Count,durationMinutes=duration});
});
auth.MapPost("/fixtures/{fid:int}/schedule", async(int fid, ScheduleRequest request, ClaimsPrincipal claims, AppDbContext db, IEmailSender email)=>
{
    if(!IsRole(claims,UserRole.Admin,UserRole.Scorer))return Results.Forbid(); var f=await db.Fixtures.FindAsync(fid); if(f is null)return Results.NotFound();
    if(f.Status is FixtureStatus.Completed or FixtureStatus.Walkover or FixtureStatus.DoubleForfeit or FixtureStatus.Abandoned or FixtureStatus.Bye) return Results.Conflict(new{message="A resolved or bye match cannot be re-scheduled."});
    if(f.HomeTeamId is null||f.AwayTeamId is null) return Results.BadRequest(new{message="This fixture is waiting for both participating teams to advance before it can be scheduled."});
    if(string.IsNullOrWhiteSpace(request.Venue)) return Results.BadRequest(new{message="A venue is required."});
    if(f.Version!=request.ExpectedVersion)return Results.Conflict(new{message="Schedule changed by another user"});
    var other=await db.Fixtures.Where(x=>x.TournamentId==f.TournamentId&&x.Id!=fid&&x.StartsAt!=null).ToListAsync();
    bool SharesTeam(Fixture x)=>(f.HomeTeamId.HasValue&&(x.HomeTeamId==f.HomeTeamId||x.AwayTeamId==f.HomeTeamId))||(f.AwayTeamId.HasValue&&(x.HomeTeamId==f.AwayTeamId||x.AwayTeamId==f.AwayTeamId));
    var clashes=other.Where(x=>x.StartsAt<request.StartsAt.AddMinutes(f.DurationMinutes)&&request.StartsAt<x.StartsAt!.Value.AddMinutes(x.DurationMinutes)&&(x.Venue==request.Venue||SharesTeam(x))).Select(x=>x.Venue==request.Venue?"venue clash":"team clash").Distinct().ToList(); if(clashes.Count>0&&!request.Override)return Results.Conflict(new{message="Schedule clash",conflicts=clashes});
    f.StartsAt=request.StartsAt;f.Venue=request.Venue.Trim();f.Status=FixtureStatus.Scheduled;f.Version++;try{await db.SaveChangesAsync();}catch(DbUpdateConcurrencyException){return Results.Conflict(new{message="Fixture changed by another user. Refresh and try again."});}await Audit(db,claims,"schedule-fixture","fixture",fid,new{request.Override,clashes});if(f.HomeTeamId.HasValue&&f.AwayTeamId.HasValue)await NotifyCaptainsOfTeamsAsync(db,new[]{f.HomeTeamId.Value,f.AwayTeamId.Value},"Match scheduled",$"Your match is scheduled for {f.StartsAt:ddd dd MMM, HH:mm} at {f.Venue}.");await SendFixtureEmailAsync(db,email,fid,"Upcoming SportsWeek match",true);return Results.Ok(new{fixtureId=fid,f.Version,conflicts=clashes});
});
auth.MapPost("/fixtures/{fid:int}/score", async(int fid, ScoreRequest request, ClaimsPrincipal claims, AppDbContext db, IEmailSender email)=>
{
    if(!IsRole(claims,UserRole.Admin,UserRole.Scorer))return Results.Forbid(); if(request.HomeScore<0||request.AwayScore<0)return Results.BadRequest(new{message="Scores cannot be negative."}); var f=await db.Fixtures.FindAsync(fid); if(f is null)return Results.NotFound(); if(f.HomeTeamId is null||f.AwayTeamId is null)return Results.BadRequest(new{message="This fixture is waiting for both participating teams to advance."}); if(f.Version!=request.ExpectedVersion)return Results.Conflict(new{message="Result changed by another scorer"}); if(f.Status is not(FixtureStatus.Pending or FixtureStatus.Scheduled))return Results.Conflict(new{message="Fixture is already resolved"}); try{f.WinnerTeamId=TournamentEngine.Winner(f.HomeTeamId,f.AwayTeamId,request.HomeScore,request.AwayScore,request.Status);}catch(ArgumentException e){return Results.BadRequest(new{message=e.Message});} f.HomeScore=request.HomeScore;f.AwayScore=request.AwayScore;f.Outcome=request.Outcome;f.Status=Enum.TryParse<FixtureStatus>(request.Status,true,out var st)?st:FixtureStatus.Completed;f.Version++;if(f.WinnerTeamId.HasValue)await AdvanceWinnerAsync(db,f,f.WinnerTeamId.Value);try{await db.SaveChangesAsync();}catch(DbUpdateConcurrencyException){return Results.Conflict(new{message="This result was updated by another scorer. Refresh and review the fixture."});}await Audit(db,claims,"score-fixture","fixture",fid,request);await NotifyCaptainsOfTeamsAsync(db,new[]{f.HomeTeamId.Value,f.AwayTeamId.Value},"Result posted",$"{f.Tournament?.Name ?? "Your match"} finished {f.HomeScore}–{f.AwayScore} ({f.Status}).");await SendFixtureEmailAsync(db,email,fid,"SportsWeek result posted",false);return Results.Ok(new{fixtureId=fid,winnerTeamId=f.WinnerTeamId,version=f.Version});
});
auth.MapPost("/fixtures/{fid:int}/correct", async(int fid, ScoreCorrectionRequest request, ClaimsPrincipal claims, AppDbContext db, IEmailSender email) =>
{
    if(!IsRole(claims,UserRole.Admin)) return Results.Forbid(); if(request.HomeScore<0||request.AwayScore<0)return Results.BadRequest(new{message="Scores cannot be negative."}); var f=await db.Fixtures.FindAsync(fid); if(f is null)return Results.NotFound(); if(f.HomeTeamId is null||f.AwayTeamId is null)return Results.BadRequest(new{message="Fixture is missing participating teams."}); if(f.Version!=request.ExpectedVersion)return Results.Conflict(new{message="Fixture changed by another user. Refresh before correcting."});
    try{f.WinnerTeamId=TournamentEngine.Winner(f.HomeTeamId,f.AwayTeamId,request.HomeScore,request.AwayScore,request.Status);}catch(ArgumentException e){return Results.BadRequest(new{message=e.Message});} f.HomeScore=request.HomeScore; f.AwayScore=request.AwayScore; f.Outcome=request.Outcome; f.Status=Enum.TryParse<FixtureStatus>(request.Status,true,out var st)?st:FixtureStatus.Completed; f.Version++; if(f.WinnerTeamId.HasValue) await AdvanceWinnerAsync(db,f,f.WinnerTeamId.Value); try{await db.SaveChangesAsync();}catch(DbUpdateConcurrencyException){return Results.Conflict(new{message="Fixture changed by another user. Refresh before correcting."});} await Audit(db,claims,"correct-score","fixture",fid,new{request.Reason,request.HomeScore,request.AwayScore}); await NotifyCaptainsOfTeamsAsync(db,new[]{f.HomeTeamId.Value,f.AwayTeamId.Value},"Result corrected",$"The recorded result for your match was corrected to {f.HomeScore}–{f.AwayScore}."); await SendFixtureEmailAsync(db,email,fid,"SportsWeek result corrected",false); return Results.Ok(new{fixtureId=fid,version=f.Version,message="Score corrected and downstream bracket refreshed."});
});

// ---------------------------------------------------------------- withdrawal & regeneration
auth.MapPost("/teams/{teamId:int}/withdraw", async(int teamId, ClaimsPrincipal claims, AppDbContext db)=>
{
    if(!IsRole(claims,UserRole.Admin))return Results.Forbid(); var team=await db.Teams.Include(x=>x.Tournament).SingleOrDefaultAsync(x=>x.Id==teamId); if(team is null)return Results.NotFound(); if(team.Status!=TeamStatus.Approved)return Results.BadRequest(new{message="Only an approved team can be withdrawn."});
    if(await db.Fixtures.AnyAsync(x=>x.TournamentId==team.TournamentId&&x.Status==FixtureStatus.Bye&&x.WinnerTeamId==teamId))return Results.Conflict(new{message="This team already advanced via a bye. Use the withdrawal + regeneration workflow so the bracket stays consistent."});
    team.Status=TeamStatus.Withdrawn; team.Tournament!.Version++; var fixtures=await db.Fixtures.Where(x=>(x.HomeTeamId==teamId||x.AwayTeamId==teamId)&&(x.Status==FixtureStatus.Pending||x.Status==FixtureStatus.Scheduled)).ToListAsync(); foreach(var f in fixtures){f.WinnerTeamId=f.HomeTeamId==teamId?f.AwayTeamId:f.HomeTeamId;f.Status=f.WinnerTeamId.HasValue?FixtureStatus.Walkover:FixtureStatus.DoubleForfeit;f.Version++;}await db.SaveChangesAsync();await Audit(db,claims,"withdraw-team","team",teamId,new{affectedFixtures=fixtures.Count});await NotifyAsync(db,[team.CaptainId],"Team withdrawn",$"{team.Name} was withdrawn from {team.Tournament!.Name}. Affected fixtures were resolved as walkovers where possible.");return Results.Ok(new{teamId,affectedFixtures=fixtures.Count});
});
auth.MapGet("/tournaments/{tid:int}/regenerate-fixtures/preview", async(int tid, int withdrawTeamId, ClaimsPrincipal claims, AppDbContext db) =>
{
    if(!IsRole(claims,UserRole.Admin))return Results.Forbid(); var snapshot=await GetRegenerationSnapshotAsync(db,tid,withdrawTeamId); if(snapshot is null)return Results.NotFound(new{message="Tournament or team not found"}); return Results.Ok(new{tournamentId=tid,snapshot.TournamentVersion,withdrawnTeamId=snapshot.WithdrawnTeamId,withdrawnTeamName=snapshot.WithdrawnTeamName,preservedWinnerIds=snapshot.PreservedWinnerIds,preservedWinnerNames=snapshot.PreservedWinnerNames,neverPlayedIds=snapshot.NeverPlayedIds,neverPlayedNames=snapshot.NeverPlayedNames,excludedTeamIds=snapshot.ExcludedTeamIds,excludedTeamNames=snapshot.ExcludedTeamNames,completedFixtureCount=snapshot.CompletedFixtureCount,newFixtureCount=snapshot.ProposedPairings.Count,message=snapshot.ProposedPairings.Count>0?"Preview ready. Completed history will be retained and only the continuation will be regenerated.":"There are not enough eligible teams to create a continuation fixture set."});
});
auth.MapPost("/tournaments/{tid:int}/regenerate-fixtures", async(int tid, RegenerateRequest request, ClaimsPrincipal claims, AppDbContext db) =>
{
    if(!IsRole(claims,UserRole.Admin))return Results.Forbid(); await using var tx=await db.Database.BeginTransactionAsync(); var tournament=await db.Tournaments.SingleOrDefaultAsync(x=>x.Id==tid); if(tournament is null)return Results.NotFound(new{message="Tournament not found"}); if(tournament.Version!=request.ExpectedVersion)return Results.Conflict(new{message="Tournament changed by another admin. Refresh the regeneration preview."}); var snapshot=await GetRegenerationSnapshotAsync(db,tid,request.WithdrawTeamId); if(snapshot is null)return Results.NotFound(new{message="Team not found in this tournament"}); if(snapshot.ProposedPairings.Count<1)return Results.BadRequest(new{message="Not enough eligible teams remain to create a valid continuation bracket."}); var withdrawn=await db.Teams.SingleAsync(x=>x.Id==request.WithdrawTeamId); withdrawn.Status=TeamStatus.Withdrawn; var activeFixtures=await db.Fixtures.Where(x=>x.TournamentId==tid&&(x.Status==FixtureStatus.Pending||x.Status==FixtureStatus.Scheduled||x.Status==FixtureStatus.Bye)).ToListAsync(); db.Fixtures.RemoveRange(activeFixtures); var roundOffset=await db.Fixtures.Where(x=>x.TournamentId==tid).MaxAsync(x=>(int?)x.RoundNo)??0; var created=new List<Fixture>(); foreach(var p in snapshot.ProposedPairings){var fixture=new Fixture{TournamentId=tid,RoundNo=p.RoundNo+roundOffset,Slot=p.Slot,HomeTeamId=p.Home,AwayTeamId=p.Away,Status=p.Bye?FixtureStatus.Bye:FixtureStatus.Pending,WinnerTeamId=p.Bye?(p.Home??p.Away):null}; db.Fixtures.Add(fixture);created.Add(fixture);} PropagateByes(created); tournament.Status="Regenerated";tournament.RegistrationOpen=false;tournament.Version++; await db.SaveChangesAsync(); db.AuditEvents.Add(new AuditEvent{ActorId=UserId(claims),Action="regenerate-fixtures",EntityType="tournament",EntityId=tid,DetailsJson=JsonSerializer.Serialize(new{request.WithdrawTeamId,request.Reason,preservedWinners=snapshot.PreservedWinnerIds,neverPlayed=snapshot.NeverPlayedIds,excluded=snapshot.ExcludedTeamIds,completedFixtureCount=snapshot.CompletedFixtureCount,newFixtureCount=created.Count,roundOffset})}); await db.SaveChangesAsync(); await tx.CommitAsync(); await NotifyAsync(db,[withdrawn.CaptainId],"Tournament bracket regenerated",$"{withdrawn.Name} was withdrawn and the continuation fixtures were regenerated without replaying completed matches."); return Results.Ok(new{tournamentId=tid,tournamentVersion=tournament.Version,withdrawnTeamId=snapshot.WithdrawnTeamId,withdrawnTeamName=snapshot.WithdrawnTeamName,preservedWinnerIds=snapshot.PreservedWinnerIds,preservedWinnerNames=snapshot.PreservedWinnerNames,neverPlayedIds=snapshot.NeverPlayedIds,neverPlayedNames=snapshot.NeverPlayedNames,excludedTeamIds=snapshot.ExcludedTeamIds,excludedTeamNames=snapshot.ExcludedTeamNames,completedFixtureCount=snapshot.CompletedFixtureCount,newFixtureCount=created.Count,createdFixtureIds=created.Select(x=>x.Id).ToList(),message="Fixtures regenerated. Completed matches remain historical and are not replayed."});
});

auth.MapGet("/audit", async(int? limit, ClaimsPrincipal claims, AppDbContext db)=>{if(!IsRole(claims,UserRole.Admin))return Results.Forbid();return Results.Ok(await db.AuditEvents.OrderByDescending(x=>x.Id).Take(Math.Clamp(limit??200,1,500)).ToListAsync());});

await app.RunAsync();

// ---------------------------------------------------------------- helpers
static object PublicUser(User u)=>new{u.Id,u.Email,u.Name,u.Department,u.Semester,u.EnrollmentNo,u.Section,u.EmailVerified,Role=u.Role.ToString()};
static int UserId(ClaimsPrincipal p)=>int.Parse(p.FindFirstValue(ClaimTypes.NameIdentifier)!);
static bool IsRole(ClaimsPrincipal p, params UserRole[] roles)=>roles.Any(r=>p.IsInRole(r.ToString()));
static string ResetPasswordBaseUrl(IConfiguration c)=>c["Email:ResetPasswordBaseUrl"]??$"{(c["Email:FrontendBaseUrl"]??"http://localhost:3000").TrimEnd('/')}/reset-password";
static List<string> ParseStringList(string json){try{return JsonSerializer.Deserialize<List<string>>(json)??[];}catch{return [];}}
static async Task<Dictionary<int,string>> TeamNamesAsync(AppDbContext db,IEnumerable<Fixture> fixtures){var ids=fixtures.SelectMany(x=>new[]{x.HomeTeamId,x.AwayTeamId}).Where(x=>x.HasValue).Select(x=>x!.Value).Distinct().ToArray();return ids.Length==0?[]:await db.Teams.Where(x=>ids.Contains(x.Id)).ToDictionaryAsync(x=>x.Id,x=>x.Name);}
static string? TeamName(Dictionary<int,string> names,int? id)=>id.HasValue&&names.TryGetValue(id.Value,out var name)?name:null;
static void PropagateByes(IEnumerable<Fixture> fixtures){var list=fixtures.ToList();foreach(var bye in list.Where(x=>x.Status==FixtureStatus.Bye)){var winner=bye.WinnerTeamId;if(winner is null)continue;var next=list.FirstOrDefault(x=>x.RoundNo==bye.RoundNo+1&&x.Slot==(bye.Slot+1)/2);if(next is null)continue;if(bye.Slot%2==1)next.HomeTeamId=winner;else next.AwayTeamId=winner;}}
static async Task<string?> ValidatePlayerIdsAsync(AppDbContext db,int tournamentId,int captainId,IEnumerable<int>? requested,int? excludeTeamId){var ids=(requested??[]).Append(captainId).Distinct().ToList();var valid=await db.Users.Where(x=>ids.Contains(x.Id)&&x.EmailVerified).Select(x=>x.Id).ToListAsync();var unknown=ids.Except(valid).ToList();if(unknown.Count>0)return $"Unknown or unverified player accounts: {string.Join(", ",unknown)}. Players must create and verify their own accounts first.";var taken=await db.TeamPlayers.Where(x=>ids.Contains(x.UserId)&&x.Team!.TournamentId==tournamentId&&(!excludeTeamId.HasValue||x.TeamId!=excludeTeamId.Value)).Select(x=>x.UserId).ToListAsync();if(taken.Count>0)return $"A player is already registered in this tournament (user id(s): {string.Join(", ",taken)}).";return null;}
static async Task AdvanceWinnerAsync(AppDbContext db,Fixture fixture,int winnerId){var next=await db.Fixtures.SingleOrDefaultAsync(x=>x.TournamentId==fixture.TournamentId&&x.RoundNo==fixture.RoundNo+1&&x.Slot==(fixture.Slot+1)/2);if(next is null)return;if(fixture.Slot%2==1)next.HomeTeamId=winnerId;else next.AwayTeamId=winnerId;next.Version++;}
static async Task<RegenerationSnapshot?> GetRegenerationSnapshotAsync(AppDbContext db,int tournamentId,int withdrawTeamId){var tournament=await db.Tournaments.AsNoTracking().SingleOrDefaultAsync(x=>x.Id==tournamentId);var withdrawn=await db.Teams.AsNoTracking().SingleOrDefaultAsync(x=>x.Id==withdrawTeamId&&x.TournamentId==tournamentId&&x.Status==TeamStatus.Approved);if(tournament is null||withdrawn is null)return null;var teams=await db.Teams.AsNoTracking().Where(x=>x.TournamentId==tournamentId&&x.Status==TeamStatus.Approved).OrderBy(x=>x.Id).ToListAsync();var fixtures=await db.Fixtures.AsNoTracking().Where(x=>x.TournamentId==tournamentId).ToListAsync();var historical=fixtures.Where(x=>x.Status is FixtureStatus.Completed or FixtureStatus.Walkover or FixtureStatus.DoubleForfeit or FixtureStatus.Abandoned).ToList();var completedTeamIds=historical.SelectMany(x=>new[]{x.HomeTeamId,x.AwayTeamId}).Where(x=>x.HasValue).Select(x=>x!.Value).ToHashSet();var winnerIds=historical.Where(x=>x.WinnerTeamId.HasValue).Select(x=>x.WinnerTeamId!.Value).ToHashSet();var lostIds=historical.SelectMany(x=>new[]{x.HomeTeamId,x.AwayTeamId}).Where(x=>x.HasValue&&!winnerIds.Contains(x.Value)).Select(x=>x!.Value).ToHashSet();var neverPlayed=teams.Where(x=>!completedTeamIds.Contains(x.Id)&&x.Id!=withdrawTeamId).ToList();var activeIds=winnerIds.Union(neverPlayed.Select(x=>x.Id)).Where(x=>x!=withdrawTeamId&&!lostIds.Contains(x)).Distinct().ToList();var preserved=teams.Where(x=>winnerIds.Contains(x.Id)&&x.Id!=withdrawTeamId&&!lostIds.Contains(x.Id)).ToList();var excluded=teams.Append(withdrawn).Where(x=>!activeIds.Contains(x.Id)).GroupBy(x=>x.Id).Select(x=>x.First()).ToList();var pairings=activeIds.Count>=2?TournamentEngine.GenerateBracket(activeIds):new List<Pairing>();return new RegenerationSnapshot(tournament.Version,withdrawn.Id,withdrawn.Name,preserved.Select(x=>x.Id).ToList(),preserved.Select(x=>x.Name).ToList(),neverPlayed.Select(x=>x.Id).ToList(),neverPlayed.Select(x=>x.Name).ToList(),excluded.Select(x=>x.Id).ToList(),excluded.Select(x=>x.Name).ToList(),historical.Count,pairings);}
static async Task<List<PublicLeaderboardRow>> PublicLeaderboardAsync(AppDbContext db,int? sportId){var teams=await db.Teams.Include(x=>x.Tournament).Where(x=>x.Status==TeamStatus.Approved&&(!sportId.HasValue||x.Tournament!.SportId==sportId.Value)).ToListAsync();var ids=teams.Select(x=>x.Id).ToArray();var fixtures=await db.Fixtures.Where(x=>x.HomeTeamId.HasValue&&x.AwayTeamId.HasValue&&x.Status!=FixtureStatus.Bye&&(ids.Contains(x.HomeTeamId.Value)||ids.Contains(x.AwayTeamId.Value))).ToListAsync();return teams.GroupBy(x=>x.Department).Select(g=>new PublicLeaderboardRow(g.Key,g.Sum(t=>fixtures.Count(f=>f.WinnerTeamId==t.Id)),g.Sum(t=>fixtures.Count(f=>f.HomeTeamId==t.Id||f.AwayTeamId==t.Id)),g.Sum(t=>fixtures.Count(f=>f.WinnerTeamId==t.Id))*3,g.Count())).OrderByDescending(x=>x.Points).ThenByDescending(x=>x.Wins).ToList();}
static bool IsGmailAddress(string email){var value=email.Trim().ToLowerInvariant();return (value.EndsWith("@gmail.com")||value.EndsWith("@googlemail.com"))&&new System.ComponentModel.DataAnnotations.EmailAddressAttribute().IsValid(value);}
static string CreateVerificationToken()=>Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
static string HashToken(string token)=>Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
static string CreateToken(User user,IConfiguration c,string key){var claims=new[]{new Claim(ClaimTypes.NameIdentifier,user.Id.ToString()),new Claim(ClaimTypes.Role,user.Role.ToString()),new Claim(ClaimTypes.Email,user.Email)};var creds=new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),SecurityAlgorithms.HmacSha256);var token=new JwtSecurityToken(c["Jwt:Issuer"],c["Jwt:Audience"],claims,expires:DateTime.UtcNow.AddHours(c.GetValue("Jwt:ExpiryHours",6)),signingCredentials:creds);return new JwtSecurityTokenHandler().WriteToken(token);}
static async Task Audit(AppDbContext db,ClaimsPrincipal p,string action,string type,int id,object details){db.AuditEvents.Add(new AuditEvent{ActorId=UserId(p),Action=action,EntityType=type,EntityId=id,DetailsJson=JsonSerializer.Serialize(details)});await db.SaveChangesAsync();}
static async Task NotifyAsync(AppDbContext db,IEnumerable<int> userIds,string title,string body){var ids=userIds.Distinct().ToArray();if(ids.Length==0)return;foreach(var id in ids)db.Notifications.Add(new Notification{UserId=id,Title=title,Body=body});await db.SaveChangesAsync();}
static async Task NotifyCaptainsOfTeamsAsync(AppDbContext db,IEnumerable<int> teamIds,string title,string body){var ids=teamIds.Distinct().ToArray();var captains=await db.Teams.Where(x=>ids.Contains(x.Id)).Select(x=>x.CaptainId).Distinct().ToListAsync();await NotifyAsync(db,captains,title,body);}
static async Task NotifyAdminsAsync(AppDbContext db,string title,string body){var admins=await db.Users.Where(x=>x.Role==UserRole.Admin).Select(x=>x.Id).ToListAsync();await NotifyAsync(db,admins,title,body);}
static async Task SendFixtureEmailAsync(AppDbContext db,IEmailSender email,int fixtureId,string subject,bool upcoming){if(!email.IsConfigured)return;var f=await db.Fixtures.Include(x=>x.Tournament).ThenInclude(x=>x!.Sport).SingleOrDefaultAsync(x=>x.Id==fixtureId);if(f is null)return;var ids=new[]{f.HomeTeamId,f.AwayTeamId}.Where(x=>x.HasValue).Select(x=>x!.Value).ToArray();if(ids.Length==0)return;var teams=await db.Teams.Where(x=>ids.Contains(x.Id)).Include(x=>x.Captain).ToListAsync();var home=teams.FirstOrDefault(x=>x.Id==f.HomeTeamId)?.Name??"TBD";var away=teams.FirstOrDefault(x=>x.Id==f.AwayTeamId)?.Name??"TBD";var message=upcoming?$"<p>Your SportsWeek match is scheduled.</p><p><b>Sport:</b> {System.Net.WebUtility.HtmlEncode(f.Tournament!.Sport!.Name)}<br/><b>Match:</b> {System.Net.WebUtility.HtmlEncode(home)} vs {System.Net.WebUtility.HtmlEncode(away)}<br/><b>Date/time:</b> {(f.StartsAt.HasValue?f.StartsAt.Value.ToString("u"):"To be announced")}<br/><b>Venue:</b> {System.Net.WebUtility.HtmlEncode(f.Venue??"To be announced")}</p>":$"<p>A SportsWeek result has been posted.</p><p><b>Sport:</b> {System.Net.WebUtility.HtmlEncode(f.Tournament!.Sport!.Name)}<br/><b>Match:</b> {System.Net.WebUtility.HtmlEncode(home)} vs {System.Net.WebUtility.HtmlEncode(away)}<br/><b>Score:</b> {f.HomeScore} - {f.AwayScore}<br/><b>Status:</b> {f.Status}</p>";foreach(var address in teams.Select(x=>x.Captain?.Email).Where(x=>!string.IsNullOrWhiteSpace(x)).Distinct())try{await email.SendAsync(address!,subject,message);}catch(Exception ex){Console.Error.WriteLine($"Email notification failed for {address}: {ex.Message}");}}
static async Task SeedAsync(AppDbContext db,ILogger logger){if(await db.Users.AnyAsync())return;logger.LogWarning("Seeding development accounts (admin@example.com / scorer@example.com). Replace or remove them before any real deployment.");db.Users.AddRange(new User{Email="admin@example.com",Name="Sports Admin",Department="Sports Committee",Semester=1,EnrollmentNo="ADMIN-001",Section="A",PasswordHash=BCrypt.Net.BCrypt.HashPassword("Admin123!"),Role=UserRole.Admin,EmailVerified=true,EmailVerifiedAt=DateTime.UtcNow},new User{Email="scorer@example.com",Name="Event Scorer",Department="Sports Committee",Semester=1,EnrollmentNo="SCORER-001",Section="A",PasswordHash=BCrypt.Net.BCrypt.HashPassword("Scorer123!"),Role=UserRole.Scorer,EmailVerified=true,EmailVerifiedAt=DateTime.UtcNow});foreach(var kv in GameCatalog.Defaults)db.Sports.Add(new Sport{Name=kv.Key,RulesJson=JsonSerializer.Serialize(kv.Value)});await db.SaveChangesAsync();}

public partial class Program { }
public record PublicLeaderboardRow(string Department,int Wins,int MatchesPlayed,int Points,int Teams);
