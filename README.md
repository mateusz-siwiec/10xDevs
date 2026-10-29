# GymTrack

A workout tracker for amateur-to-intermediate gym-goers. Log sets during a session, see your progression, and get
transparent, rule-based suggestions for what to do next, with no black box: every rule is documented below, with examples.

- **Frontend:** https://gym-track-dev.netlify.app (React + TypeScript SPA, Polish and English)
- **API:** https://gym-track-mateusz.fly.dev (`GET /api/health`)
- **Stack:** Spring Boot 4 (Java 21) · PostgreSQL + Flyway · React 19 + Vite · Playwright · Fly.io + Netlify

> The API runs on a small Fly.io machine and the database on Supabase's free tier. If the demo looks unresponsive,
> the first request may need a few seconds to wake it up.

## Features

| Area | What the user can do |
| --- | --- |
| Access | Register and log in; everyone sees only their own data |
| Exercises | Browse a seeded catalog (tagged by muscle group); add, rename and delete custom exercises |
| Plans | Create, edit, reorder and delete training plans (ordered exercises with target sets × reps) |
| Workouts | Start a session (free-form or from a plan), log and delete sets, end it; guided navigation with skip/return and a rest timer; delete a whole workout from its History page (with confirmation) |
| Insight | Progression chart per exercise, history of past workouts, dashboard with totals, 12-week volume, streak and recent records |
| Rules | Weight-increase recommendation, substitute suggestions, personal-record flag (see below) |

## Business logic

All rules are deterministic and live in the backend (`src/main/java/com/example/gymtrack/`). Nothing is applied
automatically: the app only ever **suggests**, and the user decides.

### 1. Weight-increase recommendation

*Code: `workout/ProgressionRecommendationService`.*
Shown on the workout screen when you pick an exercise.

**Rule.** Take your last **2 ended workouts** that contain the exercise. The app recommends a heavier weight only if, in
**both**:

1. the workout was started from a **plan** that contains the exercise (its target is *sets × reps*),
2. your heaviest weight for the exercise is the **same** in both workouts,
3. at that heaviest weight you did **at least the target number of sets**, and **every one of them hit the target reps**.

Lighter sets (warm-ups) are ignored. The suggestion is the top weight plus **2.5 %**, rounded to the nearest **0.5 kg**,
and always **at least 0.5 kg more** than the top weight. Nothing is suggested above 1000 kg.

**Example: it triggers.** Plan "Push day" has Barbell Bench Press **3 × 8**.

| Workout | Sets logged | Qualifies? |
| --- | --- | --- |
| Monday | 1 × 40 kg (warm-up), 3 × 8 at 60 kg | yes: top weight 60 kg, 3 sets of 8 |
| Thursday | 3 × 8 at 60 kg | yes: same top weight, 3 sets of 8 |

The workout screen then shows: *"Try 61.5 kg: you completed 3×8 at 60 kg in your last 2 workouts."*
(60 × 1.025 = 61.5, already a multiple of 0.5.)

**Example: it does not trigger.** Any one of these keeps the suggestion hidden:

| Situation | Why |
| --- | --- |
| Thursday you did 60 kg × 8, 8, **7** | One set is below the target reps |
| Thursday you did only **2** sets at 60 kg | Fewer sets than the target of 3 |
| Monday 60 kg, Thursday **62.5 kg** | Top weights differ, so the streak restarts |
| One of the two workouts was free-form (no plan) | No target to compare against |
| You have only one finished workout | The rule needs 2 |
| A workout is still running | Only ended workouts count |

**Rounding examples** (top weight → suggestion):

| Top weight | × 1.025 | Suggestion | Note |
| --- | --- | --- | --- |
| 100 kg | 102.5 | **102.5 kg** | |
| 80 kg | 82.0 | **82.0 kg** | |
| 60 kg | 61.5 | **61.5 kg** | |
| 10 kg | 10.25 | **10.5 kg** | rounded to the nearest 0.5 |
| 5 kg | 5.125 | **5.5 kg** | the minimum +0.5 kg step wins over rounding down to 5.0 |

This is intentionally a simple heuristic, not a safety or recovery system: it knows nothing about injury or fatigue.

### 2. Substitute exercise suggestion

*Code: `exercise/ExerciseService.substitutes`, `GET /api/exercises/{id}/substitutes`.*
Shown through **Find substitute** during a workout, when an exercise is unavailable (a busy bench, missing equipment).

**Rule.** Suggest every other exercise with the **same primary muscle group**, sorted A to Z. Your own custom
exercises are included; other users' custom exercises are never shown. You choose with **Use this**, and the swap is never automatic.

**Example.** The bench is taken. For *Barbell Bench Press* (primary muscle group: chest) the app lists:
other chest exercises in alphabetical order (such as *Chest Fly*, *Incline Dumbbell Press* and *Push-Up*), plus your own custom chest exercise, if you added one.
It does not list *Barbell Bench Press* itself.

Limitation: only the muscle group is compared, not the equipment or movement pattern.

### 3. Personal-record flag

*Code: `workout/PersonalRecordService`.* A set gets a **PR** badge when it beats everything you logged before for that exercise.

**Rule.** Each set gets a score of `weight × (30 + reps)`, which is the Epley one-rep-max estimate `weight × (1 + reps/30)`
multiplied by 30 so the comparison stays exact. A set is a record only if its score is **strictly higher** than every earlier set
of the same exercise. Rules of the road:

- the **first** set you ever log for an exercise is not a record (nothing to beat);
- a **tie** is not a record;
- sets above **15 reps** are ignored completely (1RM estimates are unreliable at high reps), so they are never a record and never raise the bar;
- the flag is recomputed on every read, so deleting a set re-judges the later ones.

**Example.** Bench press over time:

| Set | Score | Estimated 1RM | Result |
| --- | --- | --- | --- |
| 100 kg × 5 | 100 × 35 = 3500 | 116.7 kg | not flagged: first set |
| 90 kg × 8 | 90 × 38 = 3420 | 114 kg | no, lower than 3500 |
| 100 kg × 6 | 100 × 36 = 3600 | 120 kg | **PR** |
| 100 kg × 6 | 3600 | 120 kg | no, ties are not records |
| 60 kg × 20 | (ignored) | | no, above 15 reps |

### 4. Dashboard: totals, weekly volume and streak

*Code: `workout/DashboardService`.* Only **ended** workouts count.

- **Totals** for the last **7, 30 or 90 days** (or all time): number of workouts, total time, and total volume
  (`Σ reps × kg`). For a time window the app also returns the **previous period of the same length**, so the UI can show
  the change ("12 workouts, up from 9").
- **Weekly volume:** 12 consecutive 7-day blocks counted back from *now* (not calendar weeks); empty weeks show as zero.
- **Streak:** set a weekly goal of **1 to 14 workouts**. The streak is the number of consecutive full 7-day blocks that met the goal.
  A completed block before the current one extends it; the current block adds one more only once it has met the goal.

**Example.** Goal = 3 workouts per week.

| Block | Workouts | Meets goal? |
| --- | --- | --- |
| This week (so far) | 2 | not yet |
| Last week | 3 | yes |
| 2 weeks ago | 4 | yes |
| 3 weeks ago | 1 | no, the streak stops |

Streak = **2**. After one more workout this week it becomes **3**. With no goal set, the streak is 0.

### Input rules enforced by the API

| Field | Rule |
| --- | --- |
| Set reps | 1 to 100 |
| Set weight | above 0 and up to 1000 kg, in steps of 0.5 kg |
| Plan | name up to 60 characters; 1 to 50 entries; each entry 1 to 20 sets and 1 to 100 reps; the same exercise may repeat |
| Custom exercise | name up to 60 characters, unique among catalog and your own; cannot be deleted while used in a plan or a logged set |
| Password | 8 to 72 characters; emails are case-insensitive |
| Workouts | one active workout per user; sets can be added or removed only while it is active; deleting a workout removes its sets, and personal records, charts and recommendations recompute from what remains |

## Running locally

Prerequisites: Java 21, Node 22, Docker or Podman.

```bash
# 1. Database (Postgres 16 on :5432)
docker-compose -f podman-compose.yml up -d   # or: podman-compose up -d

# 2. Backend on :8080 (the "local" profile supplies a dev-only JWT secret)
./mvnw spring-boot:run -Dspring-boot.run.profiles=local

# 3. Frontend on :5173
cd frontend && npm install && npm run dev
```

Open http://localhost:5173 and register an account.

## Tests

| What | Command |
| --- | --- |
| Backend (JUnit, real Postgres via Testcontainers) | `./mvnw test` |
| Frontend unit | `cd frontend && npm test` |
| Frontend build and lint | `cd frontend && npm run build && npm run lint` |
| End-to-end (Playwright, Chromium) | `cd frontend && npm run test:e2e` (needs Postgres running) |

What is tested and why is described in [`context/foundation/test-plan.md`](context/foundation/test-plan.md), organised by risk.
CI (`.github/workflows/ci.yml`) runs all of the above on every pull request.

## Deployment

- **Backend:** Docker image deployed to Fly.io (`fly.toml`) by the manual *Deploy* workflow. Flyway applies pending migrations at startup.
- **Frontend:** built and served by Netlify (`netlify.toml`).
- **Database:** Supabase Postgres. Required secrets: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET` (`fly secrets set …`).

## Project documents

The project was built with AI-assisted planning; the documents that drove it live in `context/`:

| Document | Purpose |
| --- | --- |
| [`context/foundation/prd.md`](context/foundation/prd.md) | Product requirements, user stories, business logic |
| [`context/foundation/tech-stack.md`](context/foundation/tech-stack.md) | Stack choice and rationale |
| [`context/foundation/infrastructure.md`](context/foundation/infrastructure.md) | Hosting research and risk register |
| [`context/foundation/roadmap.md`](context/foundation/roadmap.md) | Milestone and delivery slices |
| [`context/foundation/test-plan.md`](context/foundation/test-plan.md) | Risk-driven test strategy |
| `context/archive/` | Plan, review and notes for each delivered change |
| [`CLAUDE.md`](CLAUDE.md) | Instructions for AI coding agents working in this repo |
