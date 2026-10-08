# SportsWeek Manager Frontend

Responsive React/Vite frontend for the SportsWeek Manager ASP.NET Core + MySQL backend.

## Run locally

```bash
cp .env.example .env
npm install
npm run dev
```

The browser-facing API URL is configured with `VITE_API_BASE_URL`; it defaults to `http://localhost:5080` in `.env.example`. The backend must allow the frontend origin in its CORS configuration.

Set `VITE_ENABLE_DEMO_FALLBACK=true` only for an intentional local design/demo session. It defaults to false so production never silently displays sample scores when the API is unavailable.

## Public pages

Visitors do not need to log in to view sports, approved teams, tournaments, fixtures, scores, leaderboards, and statistics. Public routes use the backend's `/api/public/*` read-only endpoints and intentionally omit captain contact details, enrollment numbers, private notifications, and audit data.

## Interface direction

The frontend follows an editorial sports-board direction inspired by the supplied reference: warm paper background, condensed poster typography, orange live/action states, fluorescent yellow sport filters, compact navigation, dashed fixture cards, and asymmetric broadcast-style sections. The home page includes a working sport filter. Transitions include short entrance reveals, hover lifts, live-status pulse, and reduced-motion support.

## Protected pages

Login is required for captain registration, Gmail verification status, team registration, private notifications, scoring, scheduling, team approval, and admin fixture regeneration. Captains now have a private registration/fixture/notification workspace; scorers have inline schedule and score-entry forms with expected-version handling; admins have approval, fixture-generation, and team-selector-based regeneration controls. The frontend stores the returned JWT in session storage for this MVP; production should prefer secure HttpOnly cookies or a BFF.

## Admin withdrawal/regeneration

The admin screen includes a withdrawal confirmation and regeneration preview flow. It expects the backend to expose `POST /api/tournaments/{id}/regenerate-fixtures/preview` and `POST /api/tournaments/{id}/regenerate-fixtures` with a tournament `version`. The backend must retain completed history, preserve winners and never-played teams, exclude withdrawn/lost teams, and never replay completed matchups.
