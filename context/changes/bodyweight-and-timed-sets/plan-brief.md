# Bodyweight and Timed Sets — Plan Brief

> Full plan: `context/changes/bodyweight-and-timed-sets/plan.md`

## What & Why

Every set today needs reps and a weight above 0, so ab wheel rollouts, bodyweight pull-ups and planks can't be logged. Each exercise gets a weight mode (required, optional, none) and a measure (reps or seconds), so each kind of exercise is logged the way it is actually done.

## Starting Point

`workout_sets.reps` and `weight_kg` are `NOT NULL` with weight `> 0`. Logging never loads the exercise, so it can't apply per-exercise rules. Personal records, progression suggestions, volume, history and the chart all assume reps and weight exist. The weight step was just changed to 0.25 kg (uncommitted baseline).

## Desired End State

Ab wheel logs reps only. Pull-up logs reps with an optional added weight. Plank logs seconds with an optional added weight and can be a plan target. Bench press behaves exactly as before. Records, charts, history and plans make sense for all four kinds, and nothing errors on a set without weight or reps.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Model | `weightMode` (REQUIRED/OPTIONAL/NONE) plus `measure` (REPS/DURATION) | Pull-up and plank need weight optional, so a single "bodyweight" flag is too coarse. |
| "No weight" storage | Stored as 0; `weight_kg` stays `NOT NULL`, check becomes `>= 0` | Keeps volume sums and history maths free of null handling. |
| Ab wheel | `NONE` (field hidden) | Matches how it is actually done; custom exercises can still choose OPTIONAL. |
| PR ranking | `(weight × (30 + reps), reps)` for rep sets; `(seconds, weight)` for duration | Weighted PRs are unchanged and bodyweight sets rank by reps with one rule. |
| Plan targets | Nullable `target_duration_seconds`, `reps` nullable, exactly one set | Plans stay honest (3 × 45 s) and consistent with set storage. |
| Edit lock | Measure and weight mode can't change once a set exists | Avoids history that mixes reps and seconds. |
| Progression | Chart plots the exercise's metric; suggestion skipped at weight 0 or for duration | No "+0.5 kg to your ab wheel" hints. |
| To failure | Stays for every set, including duration | A plank held until failure is a classic failure set. |
| Progression step | Rounding and minimum increase become 0.25 kg (was 0.5 kg) | Suggestions must match the new 0.25 kg weight step; done in phase 2. |
| Delivery | One change, two stages, six phases (V16 then V17) | Stage 1 ships pull-up and ab wheel before duration work starts. |

## Scope

**In scope:** weight mode and measure on exercises, validation at logging, PR/progression/chart/history/previous-workout/volume handling, duration plan targets, exercise form and logger UI, i18n (en/pl), tests, README and test plan.

**Out of scope:** body-weight profile or adjusted scoring, timers or stopwatches, new built-in exercises, other changes to the progression rule (+2.5 %, two qualifying sessions), editing measure/mode on exercises with sets, refreshing visual baselines.

## Architecture / Approach

Backend first, then frontend, within each stage. Stage 1 adds `exercises.weight_mode` (V16) and per-exercise logging validation without touching reps or plans. Stage 2 adds `exercises.measure`, `workout_sets.duration_seconds`, nullable `reps` and plan duration targets (V17). The API stays backward compatible: omitted fields default to REQUIRED/REPS, and `weightKg` stays a number in every response. Old `WorkoutSet` and `Exercise` constructors stay as overloads so existing tests keep compiling.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Weight mode (backend) | V16, enum, backfill by slug, edit lock | Dropping the old weight check by its generated name |
| 2. Weight-aware logging and stats | Per-mode validation, PR ranking, progression skip and 0.25 kg step, chart metric | PR query must compare a pair without changing weighted results |
| 3. Weight mode UI | Form control, logger field variants, `formatSet`, i18n | `8 × 60 kg` strings in e2e specs must stay identical |
| 4. Duration measure (backend) | V17, duration sets, nullable reps, plan seconds target, all consumers | A null-reps set reaching history, volume, PR or recommendation code |
| 5. Duration UI and plans | Seconds input, plan editor/walkthrough, duration formatting | Many display sites; token guard list must include new components |
| 6. E2E and docs | New Playwright specs, README and test plan | Visual baselines shifting by accident |

**Prerequisites:** commit the 0.25 kg step change (`QuarterKgStep`) first so this change starts from a clean tree; Postgres running for e2e (`podman-compose up -d`).
**Estimated effort:** ~6 sessions, one per phase; phases 4 and 5 are the largest.

## Open Risks & Assumptions

- The built-in backfill by slug is an assumption to confirm: NONE = ab wheel, banded lateral walk, copenhagen plank; OPTIONAL = pull-up, chest dip, push-up, hanging leg raise, plank.
- The 15-rep PR cap is applied only to weighted sets; bodyweight sets use the 100-rep limit.
- V16/V17 run on the Supabase DB at deploy; they only add defaulted columns and relax checks, but never run them from a local profile pointed there.
- Duration range 1-3600 s is a guess at a sensible plank ceiling.

## Success Criteria (Summary)

- Ab wheel, pull-up, plank and bench press can each be logged the way they are done, in both languages.
- Records, charts, history, previous-workout hints and plans work for every exercise kind with no errors.
- Backend suite, frontend lint/build/token guard/unit tests and the Playwright suite pass, with no unexplained visual change.
