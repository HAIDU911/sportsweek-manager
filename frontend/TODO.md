# SportsWeek Manager — Completion TODO

This backlog tracks the remaining work required to make the public portal and protected tournament operations application complete and production-ready. Completed items retain evidence in the project history; unresolved items remain open.

## Current progress

The frontend and backend build successfully. Gmail registration now refuses to claim delivery when SMTP is unavailable; MySQL readiness returns a bounded HTTP 503 when the database is down; normal fixture generation protects historical matches; withdrawal candidates are restricted to approved teams; the public sport filter and tournament-statistics loading bugs are fixed; and captain, scorer, and admin workspaces now expose registration status, private fixtures/notifications, resend verification, team approvals, inline scoring/scheduling, fixture generation, dashboard metrics, sports CRUD, tournament lifecycle editing, audit viewing, and team-selector-based regeneration. Authorized admin score correction is available with optimistic version checks.

**Re-engineering pass (October 2026)** — a full QA/architecture audit (see `docs/SPORTSWEEK_MASTER_QA_AUDIT_2026.md`) found 41 issues and 18 missing features; the fixes below are now implemented and both builds pass clean:

- **Correctness:** bye winners now propagate into the next round at bracket generation and regeneration; leaderboards (public and authenticated) exclude byes and non-approved teams; the schedule endpoint rejects resolved/byes/teamless fixtures; negative scores are rejected server-side; fixtures carry a real concurrency token with 409 conflict translation; tournament edit round-trips all scheduling metadata (partial-safe PUT); sport changes are blocked once teams/fixtures exist.
- **Notifications:** in-app notifications are produced for registration submitted (→admins), approve/reject/update/resubmit (→captain), schedule and auto-schedule (→both captains), result and correction (→both captains), withdrawal and regeneration (→withdrawn captain), with per-item and bulk read endpoints plus unread badges.
- **Accounts:** forgot-password / reset-password (hashed, single-use, 1-hour token; enumeration-safe responses), change-password for logged-in users, and a Profile page.
- **New pages:** global Schedule board (`/schedule`), Notifications (`/notifications`), Profile (`/profile`), Forgot/Reset password, round-grouped tournament brackets with “Winner of M#” placeholders, and sport-filter-aware tournament lists.
- **Captain desk:** roster builder (verified-user search with duplicate-tournament and cross-team guards), team edit & resubmit after rejection, opponent-aware fixture list with W/L result badges, notification read state.
- **Scorer desk:** result status select (Completed/Walkover/DoubleForfeit/Abandoned), knockout-draw guard, two-step confirm before posting, clash detection with explicit override, conflict recovery messages.
- **Admin desk:** create tournament form, auto-schedule panel (prefilled from tournament metadata), score & result correction panel, team directory tabs (Pending/Approved/Rejected/Withdrawn) with approve-rejected support and captain contact details, guarded tournament/sport delete, per-sport dashboard breakdown.
- **Platform:** 401 responses clear the session and explain the expiry; auth endpoints are rate-limited (20/min per client); security headers added; dead duplicate workspace pages removed; home page rebuilt on real aggregates with no fabricated data; route manifest synchronized.

Automated tests, live MySQL/Gmail acceptance, queue-backed email, and EF Core migrations remain open below.

## 1. Harden Gmail ownership verification and delivery status

- Registration accepts only syntactically valid `@gmail.com` or `@googlemail.com` addresses.
- A newly registered captain remains unverified until the one-time email token is successfully consumed.
- The verification token is cryptographically random, stored only as a hash, expires after 24 hours, and is single-use.
- Team registration is rejected server-side while the captain is unverified.
- Missing or invalid SMTP configuration must not produce a false “verification email sent” success; development must show an explicit delivery-unavailable state and production must fail safely.
- Real Gmail delivery must be manually verified with a controlled Gmail sender account and App Password stored outside source control.
- The frontend provides resend-verification UI with loading, cooldown, invalid-password, already-verified, and delivery-failure states.

## 2. Make MySQL startup and readiness production-safe

- `/health` returns a lightweight HTTP 200 liveness response without requiring MySQL.
- `/health/ready` returns HTTP 200 only when the database is reachable.
- `/health/ready` returns a controlled HTTP 503 JSON response when MySQL is unavailable; it must not expose a stack trace.
- MySQL server version detection must not cause dependency resolution to throw before the readiness handler can respond.
- Production configuration must use a least-privilege MySQL account and secrets must remain outside source control.

## 3. Protect fixture history and tournament concurrency

- Normal fixture generation is allowed only before historical matches exist, or it requires an explicit protected reset workflow.
- Completed, walkover, double-forfeit, and abandoned history cannot be deleted by normal fixture generation.
- Score and schedule mutations use expected fixture versions and return clear conflicts without overwriting newer changes.
- Tournament regeneration uses expected tournament version and a transaction.
- Withdrawal/regeneration candidates must be approved, belong to the selected tournament, and not already be withdrawn.
- Regeneration preserves completed history and winners, includes eligible never-played teams, excludes withdrawn/lost/ineligible teams, and never replays a completed matchup.
- Every destructive or structural operation writes an audit event.

## 4. Complete the public student portal

- Visitors do not need login to browse sports, approved teams, tournaments, fixtures, scores, statistics, public tournament status, sport-specific leaderboards, and overall department leaderboards.
- Public pages show only safe data: no captain emails, phone numbers, enrollment numbers, JWTs, notifications, or audit logs.
- The home sport filter filters by sport correctly rather than comparing sport IDs with tournament IDs.
- Home “In progress” shows live/in-progress matches only and does not mislabel completed matches.
- Tournament detail statistics load for the selected tournament’s sport.
- Public API failures show an explicit error/retry state in production; demo fallback is enabled only through an explicit development flag and is visibly labeled.
- Public routes work on direct navigation, mobile layouts, and shared URLs.

## 5. Complete captain authentication and team workspace

- Captains can register, verify Gmail ownership, log in, and see their verification state.
- Unverified captains are told why team registration is blocked and can resend verification without exposing whether another account exists.
- Verified captains can register a team only in an open tournament with valid team/member data.
- The captain workspace shows existing team registrations, Pending/Approved/Rejected/Withdrawn status, rejection reasons where available, approved roster data, private upcoming fixtures, result history, and private notifications.
- Duplicate submissions are prevented with a busy state and server-side idempotent behavior.
- Private captain data never appears in public API responses or public UI.

## 6. Complete scorer workspace

- Scorers can select a tournament and view fixtures with team names, venue, time, status, and current version.
- Scorers can manually schedule fixtures where permitted and receive venue/team clash feedback.
- Score entry uses an accessible in-page form rather than browser prompts.
- The form validates non-negative scores, supports relevant result statuses, and shows a review before submission.
- Stale fixture versions show a conflict state that preserves entered values and requires refresh/review.
- Completed fixtures cannot be scored again without an explicit authorized correction workflow.
- Successful results refresh the fixture, advance the winner, and show notification status.

## 7. Complete admin workspace

- Admins can view dashboard metrics from the protected API.
- Admins can create/manage sports and tournaments, including registration and lifecycle status.
- Admins can see pending team registrations and approve/reject them with feedback.
- Admins can generate fixtures safely, auto-schedule fixtures, manually schedule fixtures, and see operation summaries.
- Admins can review fixture/team statuses and audit events.
- Admins can select an approved team from a tournament instead of entering a raw team ID.
- Admins can preview withdrawal/regeneration and see preserved winners, never-played teams, excluded teams, historical fixture count, and proposed fixture count before confirmation.
- Regeneration requires an explicit confirmation step, expected tournament version, clear success summary, and safe conflict/error states.

## 8. Strengthen authorization, privacy, and security

- Frontend role guards are paired with backend authorization; frontend guards are never treated as the security boundary.
- Captains cannot manage other teams, score fixtures, schedule fixtures, approve registrations, or regenerate tournaments.
- Scorers cannot administer users, approve teams, withdraw teams, or change tournament structure unless explicitly authorized.
- Admin endpoints validate ownership/scope and role on every request.
- JWT keys, MySQL credentials, SMTP credentials, and demo credentials are not committed for production.
- Rate limiting, HTTPS, strict CORS, secure headers, structured audit logging, and secret management are documented and configured for deployment.

## 9. Add automated tests and observability

- Backend tests cover Gmail format/token expiry/single-use, unverified team denial, role authorization, score/schedule conflicts, winner advancement, and regeneration invariants.
- Integration tests run against disposable MySQL or Testcontainers.
- Frontend tests cover public navigation, filters, auth states, protected routes, score forms, conflict states, and regeneration preview.
- End-to-end tests cover public browsing, captain registration, verification, scorer entry, admin approval, and regeneration.
- Health, structured logs, email delivery status, audit events, and database failures are observable without leaking secrets.
- Load tests cover the expected campus tournament concurrency target and public scoreboard/leaderboard traffic.

## 10. Production readiness and deployment

- EF Core migrations replace `EnsureCreated` for production schema management.
- MySQL backups, restore drills, indexes, and least-privilege accounts are documented.
- Email delivery uses a queue/retry worker for heavy load and records delivery outcomes.
- Public pages and assets have an explicit caching strategy that never caches private responses.
- The frontend build, backend container, health path, CORS origin, environment variables, and rollback steps are documented.
- The final project includes updated README files, a synchronized route manifest, clean builds, tests, and a complete archive.
