# SportsWeek Manager — Application Audit

**Audit scope:** current React/Vite frontend and ASP.NET Core 8 + MySQL backend

**Audit date:** 6 October 2026

**Scope constraint:** This audit did not modify the Word document or application source files. It inspected the current project and ran available build/smoke checks.

## Executive summary

The application compiles successfully on both frontend and backend, and the public/protected route structure is present. The Gmail ownership gate is implemented correctly at the important business boundary: a user may create an account and log in with an unverified address, but the backend blocks team registration until `EmailVerified == true`.

However, the project is **not yet ready for a complete end-to-end production test or real Gmail acceptance test** because the sandbox has no running MySQL server and the current configuration contains `CHANGE_ME` SMTP placeholders. With those placeholders, registration can return a success message even though no verification email is delivered. A random address such as `not-a-real-account@gmail.com` cannot complete verification through the public API, but it can create an unverified account and receive a JWT until the frontend/backend behavior is tightened.

The largest product gap is the frontend operations workspace: the current UI does not expose the full admin/scorer feature set described by the project requirements.

## Tests executed

| Test | Result | Evidence |
|---|---|---|
| Frontend TypeScript check | PASS | `npm run typecheck` completed successfully. |
| Frontend production build | PASS | `npm run build` completed successfully; Vite emitted `dist/`. |
| Backend restore/build | PASS | `dotnet restore` and `dotnet build --no-restore -c Release` completed with 0 warnings and 0 errors. |
| Backend `dotnet test` | INCONCLUSIVE / no test suite | Command exited without test output; the repository contains no test project or test files. |
| Frontend route manifest | PASS | `/manus-routes.json` returned valid JSON with 12 routes. |
| Frontend route probes | PASS | `/`, `/sports`, `/tournaments`, `/tournaments/1`, `/teams`, `/leaderboards`, `/login`, `/register`, `/verify-email`, `/captain`, `/scorer`, and `/admin` returned HTTP 200 from Vite’s SPA fallback. |
| Backend `/health` | PASS | Returned HTTP 200 with `status: ok`. |
| Backend `/health/ready` without MySQL | FAIL | Returned HTTP 500 with a MySQL connection/`ServerVersion.AutoDetect` exception instead of the intended controlled not-ready response. |
| Live public/auth/database tests | BLOCKED | No MySQL server is running in the sandbox; the backend requires MySQL for data endpoints and authentication. |
| Real Gmail delivery test | BLOCKED | SMTP username/App Password are `CHANGE_ME` placeholders and no real sender account was configured. |

## Gmail verification: can a random email bypass it?

### What is enforced correctly

The backend registration route performs an explicit Gmail-domain check:

- accepts only addresses ending in `@gmail.com` or `@googlemail.com`;
- validates the address format;
- generates a cryptographically random 32-byte verification token;
- stores only a SHA-256 hash of the token;
- expires the token after 24 hours;
- clears the token after successful verification;
- requires `EmailVerified == true` inside `POST /api/tournaments/{id}/teams`.

The team-registration guard is the important control:

> An unverified user can log in, but cannot register a team.

A fake address such as `random.person.123@gmail.com` may pass the **format/domain** check, but it cannot complete the verification link unless the user controls that Gmail mailbox or obtains the one-time token through another compromise. The token is not returned in the registration response.

### What is not enforced yet

The system does not prove that a Gmail address exists at registration time. That is normal for email verification: the proof happens when the user receives and clicks the link. Therefore:

- `fake-name@gmail.com` can create an unverified account;
- the user can log in and receive a JWT while unverified;
- the user cannot register a team until verification succeeds;
- the user cannot legitimately obtain the token through the public API.

This is **not a team-registration bypass**, but it is a weaker account lifecycle than ideal. Consider returning a limited session or refusing application login until verification for captain accounts, while continuing to allow seeded service accounts for Admin/Scorer roles.

### Major operational issue: email failure is reported as success

Current configuration contains:

- `Smtp:Username = CHANGE_ME@gmail.com`
- `Smtp:AppPassword = CHANGE_ME`
- `Email:FromAddress = CHANGE_ME@gmail.com`

`GmailEmailSender` detects the placeholder and only logs a warning. The registration endpoint still returns HTTP 200 with “Verification email sent.” If a real SMTP send throws, the endpoint catches the exception and still returns HTTP 200.

This means the current local setup can appear to work even though no real Gmail arrives. Recommended behavior:

1. In production, fail startup if SMTP is missing for a system that requires verification.
2. In development, return an explicit `email_delivery_unavailable` status rather than claiming an email was sent.
3. Add a delivery status field to the response and notification record.
4. Move email sending to a queue/worker for retries and heavy load.
5. Add a real acceptance test using a controlled test Gmail account and a real App Password stored outside source control.

## Findings by severity

### High — frontend does not implement the complete admin workspace

The backend exposes operations for sports, tournaments, approvals, fixture generation, auto-scheduling, manual scheduling, scoring, audit, and regeneration. The current frontend Admin page only provides:

- authenticated tournament list;
- links to public tournament details;
- regeneration preview/confirmation using a manually typed team ID.

Missing or incomplete in the current frontend:

- sports management/create/edit;
- tournament create/edit/status management;
- pending team approval queue;
- approved/pending/withdrawn team directory for admins;
- fixture generation button and result summary;
- automatic schedule form;
- manual fixture scheduling form;
- score correction/reopen controls;
- audit log view;
- dashboard metrics from `/api/admin/dashboard`;
- team selector for withdrawal; current UI asks the admin to type a raw team ID;
- display of excluded teams and completed-history count in the regeneration preview.

### High — real Gmail verification is not operational with current settings

The code path exists, but SMTP is not configured. The current API can return success without delivering any email. A user cannot complete verification in this environment unless SMTP is configured with a real Gmail sender account and App Password.

### High — no automated backend or frontend test suite

The frontend package has only `typecheck`, `build`, `dev`, and `preview` scripts. There are no automated UI tests. The backend repository has no test project or test files. The tournament engine, verification flow, role policies, scoring conflicts, and regeneration algorithm are therefore not protected by repeatable automated tests.

Recommended minimum additions:

- backend xUnit tests for Gmail validation, token expiry, token single-use, unverified team-registration denial, role authorization, score version conflicts, winner advancement, and regeneration history preservation;
- integration tests against disposable MySQL/Testcontainers;
- Playwright tests for public browsing, captain verification states, scorer entry, admin approval, and regeneration;
- load tests for public scoreboard and leaderboard endpoints.

### High — normal fixture generation can delete existing history

`POST /api/tournaments/{id}/generate-fixtures` removes all fixtures for the tournament before rebuilding the bracket. There is no check that completed, walkover, or historical fixtures already exist. An admin could accidentally erase history by running normal generation after matches have started.

Recommended fix: reject normal generation once any historical fixture exists, or require a separate explicit reset workflow with a strong confirmation, audit record, and backup policy.

### Medium — readiness endpoint returns HTTP 500 when MySQL is unavailable

`UseMySql(mysql, ServerVersion.AutoDetect(mysql), ...)` attempts to connect while resolving the DbContext before the route’s `try` block can handle the database failure. `/health/ready` therefore returns a developer exception page/HTTP 500 instead of a controlled 503 JSON response.

Recommended fix: configure a known MySQL server version instead of `AutoDetect`, or create the DbContext inside a controlled readiness check. The endpoint should return a stable shape such as:

```json
{
  "status": "not_ready",
  "database": false
}
```

with HTTP 503 and no stack trace in non-development environments.

### Medium — public frontend silently replaces API failures with demo data

`withDemo()` catches every public API failure and returns hard-coded demo data. This is useful for a local design preview, but dangerous if enabled in a deployed build: a database outage, API 500, or CORS failure can show stale sample scores while the user believes they are seeing live tournament data.

Recommended fix:

- enable mock fallback only through an explicit `VITE_ENABLE_DEMO_FALLBACK=true` development flag;
- show an obvious “Demo data” banner when enabled;
- show an error/retry state in production;
- never silently substitute sample scores for a live public scoreboard.

### Medium — captain dashboard is incomplete

The current captain page supports team submission and notification display, but does not show:

- the captain’s existing teams;
- registration status and rejection reason;
- approved team roster;
- private upcoming fixtures;
- match result history;
- email verification status;
- resend-verification UI;
- team-registration history.

The frontend API client has `resendVerification`, but the registration/login UI does not expose it.

### Medium — scorer workspace uses browser prompts instead of a proper form

The scorer page uses `window.prompt()` for home and away scores. This is not suitable for a real scorer workflow because it has no sport-specific fields, no clear validation UI, no accessible labels, no confirmation summary, and no dedicated conflict-resolution experience.

The backend’s manual scheduling endpoint also exists, but the frontend API client has no `schedule()` method and the scorer/admin UI does not expose manual scheduling.

### Medium — public home sport filter is wired to the wrong identifier

The home page stores a selected sport ID, but filters fixtures with:

```ts
f.tournamentId === selectedSport
```

That compares a tournament ID to a sport ID. It can produce incorrect results whenever those IDs do not happen to match. The fixture model needs a sport ID or the filter must load/filter tournaments first and then filter fixtures by tournament membership.

### Medium — tournament statistics can show the wrong sport

`TournamentPage` starts the statistics request with `t?.data?.sportId || 1`, but the loader runs on mount and is not re-run when the tournament data arrives. For tournaments that are not sport ID 1, the statistics panel can show statistics for the wrong sport.

Recommended fix: load tournament details first, then fetch stats using the resolved `sportId`, or use a query/data-fetching layer with the sport ID as a dependency.

### Medium — regeneration candidate validation is incomplete in the backend

`GetRegenerationSnapshotAsync` loads the withdrawal candidate by tournament and team ID but does not require the candidate’s status to be `Approved`. The requirement says an approved team should be withdrawn. The endpoint should reject pending, already withdrawn, or otherwise ineligible teams before preview and confirmation.

The direct `POST /api/teams/{teamId}/withdraw` route also lacks an expected tournament version and transaction boundary. It can mutate a team without the concurrency safeguards used by the regeneration route.

### Low — captain registration form has weak UX safeguards

The registration form has no busy/submit state, so repeated clicks can create duplicate requests. It also uses a free-text “Player user IDs” field rather than a searchable roster/member selection flow. Backend duplicate checks exist, but the UI should guide the user before submission.

### Low — seeded non-Gmail admin/scorer accounts exist

The development seed creates:

- `admin@example.com` / `Admin123!`
- `scorer@example.com` / `Scorer123!`

These accounts are intentionally verified service accounts, so they do not represent a captain Gmail bypass. They must be removed or changed before any real deployment.

## Recommended test cases for the Gmail gate

Run these against a development database with SMTP configured to a controlled test sender:

1. Register `not-a-gmail@example.com` → expect HTTP 400.
2. Register `random.person.123@gmail.com` → account may be created, but expect `emailVerified: false` and a verification email to be required.
3. Log in before verification → current behavior returns a JWT; confirm the captain cannot register a team.
4. Call team registration before verification → expect HTTP 400 with the verification message.
5. Try a random token → expect HTTP 400 and no database change.
6. Use the real received token → expect HTTP 200 and `EmailVerified = true`.
7. Reuse the same token → expect HTTP 400 because the token is cleared after use.
8. Use an expired token → expect HTTP 400.
9. Register a duplicate email or enrollment number → expect HTTP 409.
10. Configure invalid SMTP → registration must not claim “email sent” in the hardened implementation.
11. Verify the user, then register a team → expect success if the tournament is open and the captain role is valid.
12. Log in as Admin or Scorer with seeded development credentials → verify service-role behavior separately, then remove those credentials before deployment.

## Final verdict

- **Can a random non-Gmail email register?** No; the backend rejects it.
- **Can a random syntactically valid Gmail address create an account?** Yes; it can create an unverified account because existence is proven through mailbox verification.
- **Can that random Gmail account bypass team-registration verification through the public API?** Not through the implemented path; team registration checks `EmailVerified` on the server.
- **Is real Gmail delivery currently working in this sandbox?** No; SMTP is still configured with placeholders and MySQL is unavailable, so live registration/email delivery could not be executed.
- **Is the whole application feature-complete?** No. The public portal is present and builds, but the admin, captain, and scorer workspaces are incomplete relative to the backend and project requirements.

The next priority should be to configure a real MySQL database and controlled Gmail sender, add automated integration tests for the verification gate, and complete the missing admin/scorer/captain frontend workflows before relying on the application for a live tournament.
