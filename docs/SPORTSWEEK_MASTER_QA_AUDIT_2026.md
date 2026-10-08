# SportsWeek Manager — Master QA & Architecture Audit

**Auditor role:** Senior Test/Q&A Engineer + Software Engineer (10+ years) review
**Audit date:** 8 October 2026
**Artifacts reviewed:** full backend (`backend/`), full frontend (`frontend/`), SQL scripts, configuration, README/TODO/audit documents
**Method:** line-by-line static review of every source file, full data-flow tracing (DB → API → API client → page), persona walkthroughs (visitor, captain, scorer, admin), failure-mode analysis, concurrency/state-machine analysis, and build verification.

---

## 1. Executive Summary

The project is a well-shaped MVP with a solid backend foundation (Minimal API + EF Core + JWT + BCrypt + bracket engine with history-preserving regeneration). Its public portal builds and mostly works, and its three role workspaces are wired.

However, a full end-to-end review found **41 findings**: **4 critical**, **9 high**, **15 medium**, **13 low** — plus **18 missing features/pages** needed before this can be placed in front of real students and admins. The most dangerous items are silent correctness bugs (bracket byes never advance, authenticated leaderboards counting byes as wins), state-machine holes (`/fixtures/{id}/schedule` can overwrite a *Completed* fixture), data-loss paths in the admin UI (editing a tournament status wipes scheduling metadata; admin update clears `ThirdPlace`), and the total absence of a notification pipeline even though the UI promises notifications.

**Verdict: NOT production-ready.** With the fixes and feature completions in this audit's plan (implemented in this re-engineering pass), it becomes a coherent, demo-safe, product-complete system.

---

## 2. Verified Baseline

| Check | Result |
|---|---|
| Repository structure | Backend (8 source files), frontend (8 source files), docs, SQL scripts present |
| Backend toolchain | .NET SDK 10.0.401 available (targets net8.0) |
| Frontend toolchain | Node v25.2.1, npm 11.6.2 available |
| Automated tests | **None** (no test project, no UI tests) |
| Dead code | Confirmed: entire old implementions of Captain/Admin/Scorer pages in `App.tsx` are unrouted duplicates |
| Duplicate page systems | `App.tsx` exports `CaptainPage/AdminPage/ScorerPage` (unused) while `Workspaces.tsx` exports the real workspaces used by the router |

---

## 3. Architecture Assessment

**Actual runtime architecture**

```
React 18 + Vite (SPA, sessionStorage JWT)
   |  fetch (api.ts; demo fallback dev-only)
   v
ASP.NET Core 8 Minimal API (Program.cs — single-file endpoints)
   |-- JWT Bearer auth (roles: Captain/Scorer/Admin)
   |-- DTOs (Contracts.cs) — DataAnnotations NOT enforced by minimal APIs
   |-- Domain: TournamentEngine.cs (bracket, scheduler, winner)
   |-- EF Core 8 + Pomelo MySQL (EnsureCreated + seed)
   |-- GmailEmailSender (synchronous SMTP inside request path)
   v
MySQL 8
```

**Strengths:** clear domain module, optimistic versioning concept, regeneration-with-history design, audit events, Gmail-only verification with hashed single-use tokens, health endpoints, CORS config, rate-limit-free but small surface.

**Architectural weaknesses (root causes of many findings):**

1. **Single 190-line `Program.cs`** holding all 30+ endpoints, helpers, and seed logic — no endpoint modules, no service layer for email/notifications, no unit-test seams.
2. **No notification producer** — `Notification` entity + `GET /api/notifications` exist, but nothing ever inserts a row. Email is the only channel, and it is sent synchronously, fire-and-forget-per-address inside requests.
3. **DTO validation is decorative** — minimal APIs do not auto-validate `[Required]`/`[Range]` on JSON bodies; each endpoint re-implements (or forgets) validation. Negative scores and empty tournament names are currently accepted.
4. **Fixture state machine not enforced centrally** — each mutation endpoint checks its own preconditions (or forgets to). `schedule` can resurrect a `Completed` fixture; `score` rejects `Bye` only by luck of its status list.
5. **Bye advancement gap** — bracket generation writes `WinnerTeamId` on byes but never propagates them into the next round; downstream matches stall with one empty slot forever.
6. **Frontend/backed contract drift** — UI promises ("live updates", "sample data", "notifications echoed here", hardcoded `WEEK 7 · FRI 24 MAY`, `/tournaments/1` links, fabricated metric fallbacks `|| 11`) do not match reality.
7. **Two generations of workspace pages coexist** — dead, buggy older pages (`window.prompt()` scoring, raw team-ID withdrawal) remain in the bundle and invite misuse.

---

## 4. Findings Register

Severity: **C**ritical / **H**igh / **M**edium / **L**ow. Each finding: Evidence → Impact → Remediation (applied in this pass unless noted).

### CRITICAL

**C-1 — Bye teams never advance in the bracket (tournament stalls).**
*Evidence:* `TournamentEngine.GenerateBracket` marks byes, and `generate-fixtures` sets `WinnerTeamId` on the bye fixture, but `AdvanceWinnerAsync` is only called from score/correction endpoints. Nothing copies the bye winner into Round 2's slot.
*Impact:* Any tournament whose team count is not a power of two (3, 5–7, 9–15, 17–31, 33–63) produces a stuck bracket: the bye team never appears in its next match; the opponent waits forever; scorers get "waiting for both participating teams".
*Fix:* propagate bye winners into the next round at generation time in both `generate-fixtures` and `regenerate-fixtures`.

**C-2 — Authenticated leaderboards award points for byes and count non-approved teams; public and private boards disagree.**
*Evidence:* the original authenticated `GET /api/leaderboards/{sportId}` / `/overall` pair used a separate SQL formulation that counted every fixture with `WinnerTeamId == team` — including `Status == Bye` (which generation stamps with a winner) — and included teams regardless of approval status. The public board was *effectively* protected against the bye bug only by its null-team-side filter (a bye has one null side), not by an explicit status check.
*Impact:* bye teams gained phantom wins/points (`Wins*3`) on the authenticated boards, non-approved teams appeared in standings, and the same logical URL family returned different numbers depending on auth — an inconsistency that would surface in any admin screenshot.
*Fix:* both families now run the same in-memory computation with explicit `Status != Bye` exclusion and approved-team-only scope; the bye exclusion is now explicit rather than incidental.

**C-3 — `POST /fixtures/{id}/schedule` can overwrite a Completed result's state.**
*Evidence:* The endpoint checks version and clashes but never checks current status; it sets `Status = Scheduled` unconditionally.
*Impact:* An accidental re-schedule of a completed match flips it from `Completed` to `Scheduled`, hides the result from results filters, corrupts stats, and emails captains a bogus "upcoming match".
*Fix:* reject scheduling for `Completed/Walkover/DoubleForfeit/Abandoned/Bye`; reject fixtures without both teams.

**C-4 — Admin "edit tournament" path destroys scheduling metadata.**
*Evidence:* `AdminWorkspace.saveTournament` sends only `{sportId, name, status, registrationOpen, thirdPlace}` — the old `TournamentPage` variant (still live in the router) sends even less. Backend `PUT /tournaments/{id}` then writes `MatchStartTime = null`, `AvailableDatesJson = []`, `VenueIdsJson = []` from the missing fields.
*Impact:* Renaming a tournament or toggling registration silently wipes its match window, available dates, and venue list — auto-scheduling then fails with "cannot fit all fixtures" and admins cannot tell why. Also, `GET /api/tournaments` (auth) does not even return `thirdPlace/availableDates/venueIds`, so the UI *cannot* round-trip them.
*Fix:* extend the authenticated tournaments payload with all scheduling fields; make `PUT` partial-safe (null = keep); UI round-trips full object.

### HIGH

**H-1 — Negative scores accepted by the API.**
`[Range(0,int.MaxValue)]` on `ScoreRequest`/`ScoreCorrectionRequest` is never enforced (minimal APIs skip DataAnnotations). Raw API callers can post `-5:-3` and corrupt stats. *Fix:* explicit guards in `score` and `correct`.

**H-2 — Notification system is vaporware.**
`GET /api/notifications` exists; nothing ever writes a `Notification`. Captain and admin UI literally render an empty "notifications" panel forever, with copy claiming echoes "when connected". *Fix:* create notifications on registration submit (→admins), approve/reject (→captain), schedule + auto-schedule (→both captains), result/correction (→both captains), withdrawal/regeneration (→withdrawn captain); add read/read-all endpoints and UI.

**H-3 — No password reset flow; no change-password.**
Real users = hundreds of students. Forgetting a password today means manual DB surgery. *Fix:* forgot/reset endpoints (hashed 1-hour token, enumeration-safe response) + `change-password` for logged-in users + pages.

**H-4 — Captain fixture & team payloads are too thin for promised UI.**
`/api/captain/fixtures` returns no team names; the captain dashboard cannot show the opponent. `/api/captain/teams` returns no roster. `TeamPlayer` rows exist but are invisible; the registration form asks for raw numeric user IDs (unusable for students). *Fix:* enrich payloads (home/away names, sport, roster with names) and add a `GET /api/users/search` roster-builder endpoint + UI.

**H-5 — Two dead workspace page generations inflate the bundle and leak old insecure patterns.**
`CaptainPage/AdminPage/ScorerPage` in `App.tsx` (browser-prompt scoring, raw-ID withdrawal, unlabeled fake states) are unrouted yet exported/imported through the same module graph. *Fix:* delete them and prune unused icons.

**H-6 — Home page is a hardcoded mock (lies to visitors).**
`api.publicFixtures(1)` (hardcoded tournament 1), fabricated metric fallbacks (`fixtures || 11`), `WEEK 7 · FRI 24 MAY → SUN 26 MAY`, hardcoded `/tournaments/1` links in topbar and "View full fixtures", "Standings · Futsal" label over the *overall* board, "SAMPLE DATA"/"Sample scores" labels over real data, "Round 3 of 4" progress that never moves. The "In progress" panel filters statuses (`Live/InProgress`) the backend can never emit. *Fix:* real aggregate endpoints + derived labels + honest empty states.

**H-7 — Sport-card "View events" filter is silently ignored.**
`SportsPage` links to `/tournaments?sport={id}`; `TournamentsPage` never reads the query string. *Fix:* read `useSearchParams`, seed the filter, show it as selected.

**H-8 — `GET /api/tournaments/{id}/fixtures` and schedule flows return `Scheduled` fixtures with null teams** — captains/scorers can register results against fixtures whose participants are undetermined later; also manual clash detection compares `null == null` team IDs producing phantom "team clash" conflicts against every TBD fixture. *Fix:* schedule endpoint requires both teams; clash check null-safe.

**H-9 — No concurrency guard on fixture rows.** `Fixture.Version` is compared but not a real concurrency token; two simultaneous scorers can both pass the version check and the later save silently overwrites the earlier result *and* its bracket advancement. Tournament has `[ConcurrencyCheck]`; Fixture does not. *Fix:* `IsConcurrencyToken()` + translate `DbUpdateConcurrencyException` to 409 in score/schedule/correct.

### MEDIUM

**M-1 — Registration bypass of phone/section rules.** `TeamRequest` `[MinLength(7)]` phone and `[AB]` section not enforced server-side. M-2 — `POST /api/tournaments` accepts empty/whitespace name (`[Required]` inert) and does not validate `EndAt ≥ StartAt`; `PUT /api/sports/{id}` can rename a sport to an existing name → MySQL unique-index 500. M-3 — `PUT /api/tournaments/{id}` allows changing `SportId` when teams/fixtures exist, silently corrupting sport-scoped leaderboards/stats. M-4 — `approve` allows approving *any* status (even `Withdrawn`), and rejected teams have **no re-approval or resubmission path** — a rejected captain is permanently locked out of the competition with no UI recourse. M-5 — `admin/teams` omits `captainPhone`/captain identity so admins cannot contact a team about a rejected registration (they have the data, just not exposed). M-6 — Score-result email says "Fixture 12" not "Team A vs Team B"; email content lacks opponent names, venue clarity, and the team list. M-7 — `SendFixtureEmailAsync` awaits each SMTP send inside the request → admin auto-schedule with 15 fixtures ≈ 30 sequential SMTP sends; request timeouts and half-notified captains. (Queue is documented as future work; mitigate by making notice creation + email best-effort and non-blocking per address.) M-8 — Forgot-password/reset and register endpoints have **no rate limiting** — brute-force and mailbox-spam risk. M-9 — `VerifyEmailPage` renders a green success panel even when verification fails (materially confusing for students). M-10 — Global 401 handling missing: after the 2-hour JWT expiry, every action returns "Request failed (401)" with no session cleanup or redirect. M-11 — Frontend pages widely ignore `error` from `useLoad` (Home, Tournament fixtures/stats, Captain, Scorer) showing perpetual "Loading" or stale content instead of error + retry. M-12 — `GET /api/leaderboards/*` (auth) compute odd correlated SQL and include non-approved teams — inconsistent with the public board for the same URL family. M-13 — Public tournaments payload lacks per-tournament completed-fixture count, forcing fake progress UI. M-14 — No tournaments-overview for a single sport on the public site beyond a filter param that (pre-fix) didn't work. M-15 — `TeamPlayer`/roster data cannot be edited after submission (no add/remove player), and teams cannot withdraw themselves or request correction post-rejection.

### LOW

**L-1** Section value validation inconsistent (`A/B` regex vs seeded section `C` demo data). **L-2** `docs`/`manus-routes.json` route manifest must be updated for every new page (scheduled in this pass). **L-3** Hardcoded "Bahria University · Sports Week 2026" footer (acceptable branding, keep). **L-4** `admin/dashboard` `games` breakdown unused by UI (now rendered in the admin desk). **L-5** Audit endpoint returns raw JSON strings; no detail expansion in UI. **L-6** No `Cache-Control` on public GETs (fine for scale, note for CDN). **L-7** `ForgotPassword` email link base URL config reuses `Email:VerificationBaseUrl` semantics — needs dedicated `Email:FrontendBaseUrl` note. **L-8** Sports list in demo fallback lacks "Tug of War" (7 seeded sports vs 6 demo). **L-9** `window.confirm` for regeneration is the only remaining native dialog (acceptable but noted). **L-10** `register` 502 after account creation leaves an orphaned unverified account with a confusing message; user hint to "resend verification" needed. **L-11** No favicon/logo asset (uses plain text mark + placeholder logo URL). **L-12** No `<noscript>` fallback. **L-13** `appsettings.json` has `Smtp:UseSsl` unused (hardcoded `EnableSsl=true`). **L-14 (run-blocker, fixed in this pass)** No `backend/Properties/launchSettings.json` existed, so `dotnet run` bound to port 5000 while the frontend `.env` and README both expect 5080 — a fresh clone could never connect the two halves. Added the standard launch profile (`applicationUrl: http://localhost:5080`, Dev environment); runtime-verified `/health` 200 and `/health/ready` clean 503. Also verified: this machine only has the .NET 10 runtime, so a locally built net8.0 app needs `DOTNET_ROLL_FORWARD=Major` (or the .NET 8 runtime) to launch.

---

## 5. Missing Features & Pages (student/admin facing)

| # | Missing item | Persona | Status in this pass |
|---|---|---|---|
| 1 | Global **Schedule** page (all sports, upcoming/results, date-grouped) | Visitor | Implemented |
| 2 | **Notifications** page with read/read-all + unread badge | All roles | Implemented |
| 3 | **Profile** page (account info + change password + sign out) | All roles | Implemented |
| 4 | **Forgot/Reset password** pages + backend | All roles | Implemented |
| 5 | Captain **roster builder** (search users, chips, remove) + roster display | Captain | Implemented |
| 6 | Captain **opponent display** + result W/L + venue | Captain | Implemented |
| 7 | Captain **notification mark-as-read** | Captain | Implemented |
| 8 | Admin **create tournament** form (API existed, no UI) | Admin | Implemented |
| 9 | Admin **auto-schedule** form (API existed, no UI) | Admin | Implemented |
| 10 | Admin **score & result correction** panel (API existed, no UI) | Admin | Implemented |
| 11 | Admin **team directory tabs** (Pending/Approved/Rejected/Withdrawn) + approve rejected | Admin | Implemented |
| 12 | Admin **delete tournament/sport** (guarded, audit-logged) | Admin | Implemented |
| 13 | Admin **per-sport dashboard breakdown** | Admin | Implemented |
| 14 | Scorer **result status select** (Walkover/DoubleForfeit/Abandoned) + two-step confirm + draw rule message | Scorer | Implemented |
| 15 | Tournament detail **round-grouped bracket** with "Winner of M#" labels | Visitor | Implemented |
| 16 | Public **fixtures board API** (cross-tournament, filterable) | System | Implemented |
| 17 | **Route manifest** update + TODO/README sync | System | Implemented |
| 18 | **Rate limiting** on auth endpoints + security headers | System | Implemented |

### Residual (documented, deliberately deferred)
SignalR live push (poll/manual refresh acceptable for campus scale), queue-backed email worker, EF Core migrations replacing `EnsureCreated` (SQL migration file added for the new columns), automated test projects (backlog in §7), certificate/export generation, SMS channel, multi-language.

---

## 6. Persona Flow Walkthroughs (post-fix target behavior)

**Visitor:** Home shows real aggregate counts and the next scheduled fixtures from *all* tournaments → Schedule page filters by sport and shows date-grouped upcoming/results → Tournament page shows round-grouped bracket with winner-of labels, live stats, and a registration CTA when open → Teams directory filterable by sport → Leaderboards per sport + overall (bye-safe) → no fabricated numbers anywhere.

**Captain:** Register (Gmail enforced both ends) → verify (clear success *and* failure states) → login → dashboard shows verification banner + resend with cooldown → register team with **roster search** (verified users only, duplicate-tournament players rejected) → see status incl. Rejected reason + admin contact flow → notifications update with read state → fixtures list shows opponents, times, venues, scores, W/L.

**Scorer:** Select tournament → fixtures with clear "waiting for teams" states → schedule with clash feedback → score with status select, negative/format validation, two-step confirm, knockout-draw guard, 409 conflict recovery, and post-save advancement feedback.

**Admin:** Dashboard (incl. per-sport) → create/edit tournaments with full scheduling metadata round-trip → sports CRUD (safe delete) → approval queue + full directory tabs → generate fixtures (bye-safe) → auto-schedule → manual schedule → correct results → withdraw/regenerate with preview → audit trail → notifications on every captain-affecting action.

---

## 7. Test Strategy

**Manual acceptance suite (executed logically against the code; to be re-run live):** Gmail gate (12 cases from previous audit) + new cases:
1. 3-team tournament → generate → bye team appears in final immediately (C-1 regression).
2. Leaderboard after byes → no points for byes (C-2).
3. Schedule a Completed fixture → 409 (C-3).
4. Edit a tournament name → dates/venues intact (C-4).
5. POST score with -1 → 400 (H-1).
6. Two parallel score posts, same expectedVersion → second returns 409 (H-9).
7. Sports card → `/tournaments?sport=2` → list filtered (H-7).
8. Approve/reject/schedule/score → captain notifications appear and mark read (H-2).
9. Forgot → reset → login with new password; old password rejected (H-3).
10. Roster search: duplicate player in same tournament → 409 with team conflict message (existing check, new UI).

**Automation backlog (not executed here; documented for team):** xUnit for `TournamentEngine` (bracket sizes 2–64, bye propagation, schedule fitting, winner rules), integration tests via Testcontainers MySQL for auth/score/regeneration, Playwright for the flows above, plus k6 smoke on public leaderboard endpoints.

---

## 8. Re-Engineering Plan (executed in this pass)

**Backend**
1. Bye propagation helper; applied to generate + regenerate.
2. Bye-safe leaderboards; unify auth/public leaderboard computation.
3. Schedule endpoint: status guard, team guard, null-safe clashes.
4. Negative-score guards; fixture concurrency token + 409 translation.
5. Tournament payload enrichment (auth + public + completed counts); partial-safe `PUT`; sportId-change guard; name/date validation; sport rename dedupe; tournament/sport guarded DELETE.
6. New endpoints: `GET /api/public/fixtures`, `GET /api/users/search`, notifications read/read-all + producer calls, forgot/reset/change password, admin teams enrichment (captain contact), tournament lifecycle.
7. Rate limiting on auth group; security headers; CORS origins config present.
8. Notification creation at all captain-affecting transitions; richer fixture emails (team names); email failures degrade to warnings.
9. Seed hardening note + new SQL migration file for password-reset columns.

**Frontend**
10. Prune dead pages; fix Layout (nav + topbar links + bell badge); 401 auto-logout in `api.ts`.
11. New pages: Schedule, Notifications, Profile, Forgot, Reset; route manifest update.
12. Home page rebuilt on real aggregates; honest labels; derived hero range.
13. TournamentsPage query-param filter; TournamentPage round grouping + winner-of labels + CTA + error states.
14. Captain workspace: roster builder + roster display + opponents + notification read.
15. Scorer workspace: status select, validation, two-step confirm, conflict UX.
16. Admin workspace: create tournament, auto-schedule, correction panel, directory tabs, per-sport metrics, guarded deletes.
17. CSS system extension for all new components in the existing editorial theme.
18. Build verification: `dotnet build`, `npm run build`, typecheck.

---

## 9. Final Verdict

| Question | Answer |
|---|---|
| Can a student break the bracket by opening the site? | No, but byes silently stall tournaments without C-1 fix (now fixed). |
| Can an admin accidentally destroy match history? | Previously yes (C-3/C-4 paths); now guarded. |
| Do visitors ever see fabricated data? | Previously yes (H-6); now all labels/numbers are real or explicitly empty. |
| Is the claimed "notifications" feature real? | Previously no; now produced, readable, badge-able. |
| Is the system demo-ready for students + admins? | Yes after this pass: complete visitor/captain/scorer/admin surfaces, honest states, guarded history. |
| Is it production-hardened for scale? | Close: queue-based email, migrations, and automated tests remain on the documented backlog (§7). |
