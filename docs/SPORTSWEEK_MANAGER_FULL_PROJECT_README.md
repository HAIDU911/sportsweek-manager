# SportsWeek Manager — Complete Project Archive

This archive contains the complete SportsWeek Manager project for Bahria University.

## Included components

- `sportsweek-frontend/` — React + Vite responsive frontend.
- `sportsweek-backend/` — ASP.NET Core 8 backend with MySQL and Entity Framework Core.
- `docs/` — Original project proposal and additional requirements.

## Frontend setup

```bash
cd sportsweek-frontend
cp .env.example .env
npm install
npm run dev
```

Set `VITE_API_BASE_URL` in `.env` to the URL of the ASP.NET Core backend.

## Backend setup

```bash
cd sportsweek-backend
cp appsettings.Development.example.json appsettings.Development.json
# Configure MySQL, JWT, and Gmail SMTP values
mysql -u root -p < mysql-setup.sql
dotnet restore
dotnet run
```

Use the included `README.md`, `SPORTSWEEK_MANAGER_PROJECT_README.md`, `mysql-setup.sql`, and `mysql-email-migration.sql` for detailed configuration and deployment guidance.

## Main behavior

Public tournament information can be viewed without login. Captain registration requires a real Gmail address and email ownership verification. Scorers and administrators use protected role-aware workspaces. Administrators can withdraw a team and regenerate only the remaining continuation fixtures while preserving completed history and avoiding repeated matchups.

Generated folders such as `node_modules`, `dist`, `bin`, `obj`, virtual environments, caches, and Git metadata are intentionally excluded so the archive remains portable and source-focused.
