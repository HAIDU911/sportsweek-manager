using Microsoft.EntityFrameworkCore;
using SportsWeekManager.Models;

namespace SportsWeekManager.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Sport> Sports => Set<Sport>();
    public DbSet<Tournament> Tournaments => Set<Tournament>();
    public DbSet<Team> Teams => Set<Team>();
    public DbSet<TeamPlayer> TeamPlayers => Set<TeamPlayer>();
    public DbSet<Fixture> Fixtures => Set<Fixture>();
    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();
    public DbSet<Notification> Notifications => Set<Notification>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>().HasIndex(x => x.Email).IsUnique();
        b.Entity<User>().HasIndex(x => x.EnrollmentNo).IsUnique();
        b.Entity<Sport>().HasIndex(x => x.Name).IsUnique();
        b.Entity<Team>().HasIndex(x => new { x.TournamentId, x.Name }).IsUnique();
        b.Entity<Fixture>().HasIndex(x => new { x.TournamentId, x.RoundNo, x.Slot }).IsUnique();
        b.Entity<Fixture>().HasIndex(x => new { x.TournamentId, x.StartsAt, x.Venue });
        b.Entity<Tournament>().Property(x => x.Version).IsConcurrencyToken();
        b.Entity<TeamPlayer>().HasKey(x => new { x.TeamId, x.UserId });
        b.Entity<Team>().HasOne(x => x.Captain).WithMany(x => x.CaptainedTeams).HasForeignKey(x => x.CaptainId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<TeamPlayer>().HasOne(x => x.User).WithMany(x => x.TeamPlayers).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<TeamPlayer>().HasOne(x => x.Team).WithMany(x => x.Players).HasForeignKey(x => x.TeamId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<Tournament>().HasOne(x => x.Sport).WithMany(x => x.Tournaments).HasForeignKey(x => x.SportId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Team>().Property(x => x.Status).HasConversion<string>();
        b.Entity<User>().Property(x => x.Role).HasConversion<string>();
        b.Entity<Fixture>().Property(x => x.Status).HasConversion<string>();
    }
}
