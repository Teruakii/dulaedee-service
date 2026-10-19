# dulaedee-service

Backend API for **dulaedee** (ดูแลดี, "take good care"), a health app for friends and family. It counts calories for Thai dishes, suggests the next meal, and tracks water, weight, skin routines and workouts. Streaks, badges and weekly group challenges keep people coming back.

Node 22+ · TypeScript · Express 5 · MongoDB · zod. Each module has its own model, dto, repo, service, handler and module file.

Frontend: [`dulaedee-client-web`](https://github.com/Teruakii/dulaedee-client-web)

## Screenshots

More in the [frontend README](https://github.com/Teruakii/dulaedee-client-web).

| Today | Food | Summary | Group challenge |
|---|---|---|---|
| <img src="https://raw.githubusercontent.com/Teruakii/dulaedee-client-web/main/.github/screenshots/today.png" width="200" alt="today"> | <img src="https://raw.githubusercontent.com/Teruakii/dulaedee-client-web/main/.github/screenshots/food.png" width="200" alt="food"> | <img src="https://raw.githubusercontent.com/Teruakii/dulaedee-client-web/main/.github/screenshots/summary.png" width="200" alt="summary"> | <img src="https://raw.githubusercontent.com/Teruakii/dulaedee-client-web/main/.github/screenshots/group.png" width="200" alt="group"> |

## Getting started

```bash
docker compose up -d          # MongoDB on 27017 (needs Docker Desktop)
cp .env.example .env          # then set a new JWT_SECRET_KEY
npm install
npm run dev                   # http://localhost:3200
```

If `SEED_ADMIN_PASSWORD` is not set, a random password for the `admin` user is generated and printed to the log once, when the database is empty.

To try it without MongoDB, run `npm run dev:demo`. It starts the API on port 3200 with an in-memory MongoDB and sample data. Log in with `mind@example.com` / `password1` (admin: `admin` / `admin-demo-pass`).

## Testing

```bash
npm run typecheck   # tsc, including test files
npm test            # 56 unit tests
npm run smoke       # 36 end-to-end checks
npm run build
```

- **Unit tests** cover calorie targets, menu recommendations, skin ingredient clashes, streaks and badges, quick add, the group board, auth tokens and cookies.
- **Smoke checks** (`scripts/smoke.ts`) start the real server against an in-memory MongoDB and walk every main flow over HTTP. Examples:
  - signup, email verification and password reset
  - logging food and copying yesterday's meal
  - a member cannot read or change another member's data
  - group members see only first names and day counts
  - outsiders get 404, and a rotated invite link stops working
  - repeated wrong passwords get rate limited
  - deleting an account removes all of its data

## Modules

| Path | Access | Purpose |
|---|---|---|
| `/auth` | public / logged in | Sign up (MEMBER) and log in with username or email. `/me` refreshes the session from an httpOnly cookie. Also: Google login, email verification, forgot and change password |
| `/users` | ADMIN | Manage accounts |
| `/profile` | owner | Body data, goal, skin type, notification settings and the daily budget. `POST /profile/calc` is public |
| `/foods` | logged in; ADMIN/STAFF edit the shared menu | Thai menu search, members' own menus, and `/foods/recommend` for dishes that fit the remaining budget |
| `/daylogs` | owner | Daily log of meals, water, weight, skin steps done and workouts. History for charts, `/quick` for frequent and yesterday's meals, `/streaks` for streaks and badges |
| `/workouts` | owner | Weekly workout plan |
| `/skin` | owner | Products, morning and night routines, and ingredient clash warnings |
| `/groups` | members of the group | Weekly challenges joined by invite link. Members see only first names and how many days each person met the challenge |
| `/clips` | logged in; ADMIN/STAFF curate | YouTube clips linked to dishes, and `/clips/recommend` |
| `/weather` | logged in | UV and humidity from Open-Meteo, with advice codes |
| `/push` | logged in | Web Push subscriptions for water, UV and skin reminders (Bangkok time) |
| `/account` | owner | Delete my account and all of its data |

## Before real use

- The seeded menus in `src/modules/food/food.seed.ts` are estimates (`verified: false`). Check them against INMUCAL or the Thai Department of Health tables.
- The `CLASHES` table in `src/modules/skin/clash.ts` is general guidance. A dermatologist should review it.
- Set `SMTP_URL` (for example Gmail with an App Password). Until then, emails are only written to the log.
