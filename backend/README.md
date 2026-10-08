# SportsWeek Manager — ASP.NET Core + MySQL Backend

This is the C# / ASP.NET Core version of SportsWeek Manager. It replaces the earlier SQLite/Python reference backend with **ASP.NET Core 8 Minimal API**, **Entity Framework Core**, **Pomelo MySQL provider**, **JWT authentication**, and **MySQL Workbench-compatible database configuration**.

## Requirements

- .NET 8 SDK
- MySQL Server 8.x running on your PC
- MySQL Workbench, optional but recommended for executing `mysql-setup.sql` and inspecting tables
- Visual Studio 2022, JetBrains Rider, or VS Code with C# Dev Kit

## MySQL Workbench setup

1. Open MySQL Workbench and connect to your local MySQL Server.
2. Open `mysql-setup.sql` from this project.
3. Change `CHANGE_THIS_STRONG_PASSWORD` to a strong password.
4. Execute the script.
5. Update the connection string in `appsettings.Development.json`.

Example connection string using the dedicated application account:

```json
{
  "ConnectionStrings": {
    "MySql": "Server=localhost;Port=3306;Database=sportsweek;User=sportsweek_app;Password=YOUR_PASSWORD;TreatTinyAsBoolean=true;Allow User Variables=true"
  }
}
```

If your local MySQL server uses a different host, port, username, or password, change those values. Do not commit a real password to source control. A safer local approach is an environment variable:

```powershell
$env:ConnectionStrings__MySql="Server=localhost;Port=3306;Database=sportsweek;User=sportsweek_app;Password=YOUR_PASSWORD;TreatTinyAsBoolean=true"
$env:Jwt__Key="a-long-random-development-secret-at-least-32-characters"
```

## Run locally

```bash
dotnet restore
dotnet run
```

The default development URL is `http://localhost:5080`. Open Swagger at:

```text
http://localhost:5080/swagger
```

On first startup, the application creates the database tables with EF Core `EnsureCreated` and seeds:

- `admin@example.com` / `Admin123!`
- `scorer@example.com` / `Scorer123!`
- Futsal, Cricket, Basketball, Badminton, Table Tennis, Tug of War, and Chess

Change or delete demo accounts before any real deployment.

If you already created the `sportsweek` database from the earlier C# package, run `mysql-email-migration.sql` once in MySQL Workbench to add the email-verification columns, then run `mysql-team-review-migration.sql` for the team review reason column. For production, convert these changes into a proper EF Core migration instead of manually editing the schema.

## Main endpoints

- `GET /health`
- `GET /health/ready`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/verify-email?email=...&token=...`
- `POST /api/auth/resend-verification`
- `GET /api/public/sports`
- `GET /api/public/teams`
- `GET /api/public/tournaments`
- `GET /api/public/tournaments/{id}`
- `GET /api/public/tournaments/{id}/fixtures`
- `GET /api/public/leaderboards/{sportId}`
- `GET /api/public/leaderboards/overall`
- `GET /api/public/statistics/{sportId}`
- `GET /api/sports`
- `GET /api/tournaments`
- `POST /api/tournaments`
- `GET /api/admin/dashboard`
- `POST /api/tournaments/{id}/teams`
- `POST /api/registrations/{id}/approve`
- `POST /api/tournaments/{id}/generate-fixtures`
- `GET /api/tournaments/{id}/fixtures`
- `POST /api/tournaments/{id}/auto-schedule`
- `POST /api/fixtures/{id}/schedule`
- `POST /api/fixtures/{id}/score`
- `POST /api/teams/{id}/withdraw`
- `GET /api/tournaments/{id}/regenerate-fixtures/preview?withdrawTeamId={teamId}`
- `POST /api/tournaments/{id}/regenerate-fixtures`
- `GET /api/leaderboards/{sportId}`
- `GET /api/leaderboards/overall`
- `GET /api/notifications`
- `GET /api/captain/teams`
- `GET /api/captain/fixtures`
- `GET /api/admin/teams?status=Pending`
- `POST /api/registrations/{id}/reject`
- `GET /api/audit`

Use the Swagger UI for request schemas and to test bearer-token-protected routes.

### Withdrawal and fixture regeneration

An Admin can preview and confirm a mid-tournament team withdrawal through the regeneration endpoints. The preview identifies preserved winners, teams that have not completed a match, excluded/withdrawn teams, historical completed-fixture count, and the proposed continuation fixture count. Confirmation is protected by the tournament `Version` value for optimistic concurrency, runs in a database transaction, marks the withdrawn team, removes only pending/scheduled/bye continuation fixtures, preserves completed history, and creates new continuation rounds with non-colliding round numbers. Completed matchups are never replayed, and an audit event records the operation.

The `/api/public/*` endpoints are intentionally unauthenticated and read-only. They expose tournament status, approved team names, fixture schedules, scores, safe leaderboard aggregates, and game statistics. They do not expose captain emails, phone numbers, enrollment numbers, notifications, or audit logs. The authenticated endpoints below remain protected for team registration, scoring, scheduling, administration, and private notifications.

## Gmail-only registration and captain notifications

Team captains must register with a real `@gmail.com` or `@googlemail.com` address. Checking the domain alone is not enough to prove ownership, so the workflow also sends a one-time verification link to that mailbox. The link expires after 24 hours. An unverified captain can log in but cannot register a team until the verification endpoint has been completed.

After a captain's email is verified, the system uses that address for:

- Upcoming-match emails when a fixture is manually scheduled.
- Upcoming-match emails when automatic tournament scheduling assigns a fixture.
- Result emails after a scorer or admin records a match result.

### Gmail configuration

Do not use your normal Gmail password. Create a Google **App Password** for the Gmail account that will send system emails:

1. Turn on 2-Step Verification for the sender Gmail account.
2. Create an App Password in the Google Account security settings.
3. Put the 16-character App Password in an environment variable or secret manager.
4. Configure:

```powershell
$env:Smtp__Host="smtp.gmail.com"
$env:Smtp__Port="587"
$env:Smtp__Username="your-sportsweek-sender@gmail.com"
$env:Smtp__AppPassword="YOUR_16_CHARACTER_APP_PASSWORD"
$env:Email__FromAddress="your-sportsweek-sender@gmail.com"
$env:Email__VerificationBaseUrl="http://localhost:3000/verify-email"
```

The frontend verification page should read the `email` and `token` query parameters and call `GET /api/auth/verify-email`. In production, `Email:VerificationBaseUrl` must be the HTTPS URL of your real frontend.

If SMTP is not configured, captain registration and resend-verification return an explicit HTTP 503 delivery-unavailable response instead of falsely claiming that an email was sent. Configure the Gmail sender before testing captain registration.

For heavy traffic, replace direct SMTP calls inside API requests with a queue-backed notification worker. Store delivery status, retry failed messages with exponential backoff, and use a provider such as SendGrid, Amazon SES, Microsoft Graph, or a managed institutional SMTP relay if Gmail daily limits are insufficient.

## Architecture

```text
ASP.NET Core Minimal API
        |
        +-- JWT authentication and role policies
        +-- API validation DTOs
        +-- TournamentEngine domain service
        +-- EF Core DbContext
        +-- Pomelo MySQL provider
        +-- MySQL Server / Workbench
```

Domain logic is kept in `Domain/TournamentEngine.cs`. It contains bracket generation, automatic schedule slot generation, and winner calculation independent from HTTP controllers.

## Security notes

The project includes JWT authentication and BCrypt password hashing, but it is still a development/MVP baseline. Before production:

- Replace demo accounts and all placeholder secrets.
- Use a secret manager or environment variables for JWT keys and database credentials.
- Integrate your university identity provider or another OIDC provider with MFA.
- Restrict CORS to the actual frontend URL.
- Require HTTPS and configure HSTS and secure headers.
- Use a dedicated MySQL account with only the required database privileges; do not use `root`.
- Add rate limiting for login, registration, and public endpoints.
- Add policy-based authorization and ownership checks for captains.
- Add structured, append-only audit events for score corrections and administrative overrides.
- Do not expose phone numbers, enrollment numbers, JWTs, or passwords in public responses/logs.
- Replace `EnsureCreated` with EF Core migrations for production schema management.

## Production migrations

For production, install the EF CLI and use migrations instead of `EnsureCreated`:

```bash
dotnet tool install --global dotnet-ef
dotnet ef migrations add InitialMySqlSchema
dotnet ef database update
```

Then remove or disable `Database.EnsureCreatedAsync()` in the startup path and apply migrations through a controlled deployment step.

## Scaling for heavy load

For a serious sports week, move to:

- MySQL InnoDB on a managed or highly available server
- Multiple stateless API instances behind a load balancer
- Redis for public bracket/leaderboard caching and rate-limit counters
- A queue for reminders, email/SMS, reports, and cache invalidation
- SignalR with a Redis backplane for live score updates
- Read replicas for public leaderboard traffic
- Database indexes on tournament, fixture, schedule, team, and audit columns
- OpenTelemetry metrics/traces and centralized structured logs
- k6/Locust load testing with the proposal's 300-concurrent-user target
- Automated backups, restore drills, health probes, and graceful deployment rollback

The fixture engine should remain deterministic and separately tested. Score entry and schedule changes should use database transactions, optimistic concurrency, and idempotency keys.

## Docker

```bash
docker build -t sportsweek-manager-dotnet .
docker run --rm -p 8080:8080 \
  -e ConnectionStrings__MySql="Server=host.docker.internal;Port=3306;Database=sportsweek;User=sportsweek_app;Password=YOUR_PASSWORD" \
  -e Jwt__Key="a-long-random-secret-at-least-32-characters" \
  sportsweek-manager-dotnet
```

On Linux, `host.docker.internal` may require an extra host-gateway setting; use the host machine's reachable IP if needed.

## Known MVP limitations

- SignalR live updates are not yet wired into the API.
- Notification delivery is stored-model ready but does not yet connect to email/SMS providers.
- Score validation is generic; sport-specific structured scoring should be added for cricket overs, badminton games, penalties, overtime, and chess time controls.
- Controlled result reopening and downstream rollback should be implemented before real tournaments.
- A production SQL migration set should replace `EnsureCreated`.
- The current API does not include the frontend portals.
