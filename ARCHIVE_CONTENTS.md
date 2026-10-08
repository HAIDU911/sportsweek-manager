# SportsWeek Manager — Updated Complete Archive

This archive contains the current university tournament management system.

## Included functionality

- Public unauthenticated scoreboard, fixtures, scores, statistics, sports, approved teams, and leaderboards.
- Gmail-only captain registration with hashed, expiring, single-use verification tokens.
- Captain workspace with team status, rejection reasons, private fixtures, notifications, and resend-verification cooldown.
- Scorer workspace with accessible score and schedule forms, optimistic version checks, clash feedback, and winner advancement.
- Admin workspace with dashboard metrics, sports create/edit, tournament lifecycle editing, approval queue, safe fixture generation, audit viewer, and withdrawal/regeneration preview.
- Protected admin-only score correction route with expected-version validation and audit event.
- ASP.NET Core 8 + EF Core + MySQL backend and React/Vite/TypeScript frontend.

## Setup

1. Configure MySQL using the backend SQL scripts.
2. Configure `ConnectionStrings__MySql`, `Jwt__Key`, and Gmail SMTP settings outside source control.
3. Start the backend with .NET 8 and the frontend with Node.js/npm.
4. Public browsing requires no login; captain, scorer, and admin operations are protected by JWT role authorization.

Generated folders and secrets are intentionally excluded from this archive.
