# Track muscular failure on logged sets — Plan Brief

> Full plan: `context/changes/muscular-failure-tracking/plan.md`

## What & Why

Let the user record whether a set was taken to muscular failure, and see that back later. Failure is a core piece of how people judge a set's difficulty, and today the log only has reps and weight, so a hard set to failure looks the same as an easy one.

## Starting Point

A logged set stores only exercise, reps, weight and a timestamp, and sets can be created and deleted but not edited. Sets are read back in the active workout list, history detail, the previous-workout hint and the muscle stats page. The weight-increase recommendation uses only reps and weight, and the PRD parks "RPE-style" signals as a non-goal.

## Desired End State

Logging a set has a "To failure" checkbox that resets after each set. Sets taken to failure carry a badge in the active workout, in history and in the previous-workout hint, and the muscle stats page shows how many sets per parent and per muscle went to failure. Recommendations, records and volume are unchanged, and old sets simply show no badge.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| What is recorded | Yes/no "taken to failure" flag | One tap per set and not an RPE scale, so it stays close to the PRD's reps-only stance. | Plan |
| Logging UX | Checkbox that resets after each set | Failure is usually only the last set, so carrying it over would log false failures. | Plan |
| Where it shows | Active set list, history detail, previous-workout hint, per-muscle failure counts on the stats page | Covers where sets are read back, without a new dashboard tile. | Plan |
| Progression | Recommendation rule unchanged | Respects the PRD non-goal and the deterministic rule the product is built on. | Plan |
| Old sets | Default to not marked (false) | A non-null boolean with a column default needs no backfill. | Plan |
| API shape | Optional `toFailure` on log-set, defaults to false | Existing clients and tests keep working unchanged. | Plan |

## Scope

**In scope:** `V13` column, entity/request/responses, failure counts in muscle stats, logging checkbox, badges in three views, stats page failure text, tests, README note, Windows baseline refresh.

**Out of scope:** RPE or reps-in-reserve, any effect on recommendations or records, editing existing sets, dashboard tile, plan targets for failure, backfill.

## Architecture / Approach

One boolean column flows from the log-set request into the entity and out through every set-listing response; one grouped stats query gains a conditional count. The frontend adds the checkbox to the set logger and one shared badge used in three places, plus a muted failure count on the stats rows.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Backend data and API | `V13`, flag in request and responses, failure counts in stats, tests | Existing tests/callers that build sets or post sets must keep working |
| 2. Frontend foundation and logging | Types, strings, checkbox with reset, badge in the active list | Reset semantics when a log fails |
| 3. Read-back surfaces | Badge in history and the hint, failure counts on the stats page, e2e | Stats rows stay readable with the extra text |
| 4. Docs, baselines, full suites | README, refreshed workout-ui baselines, green suites | The checkbox changes the workout screenshots |

**Prerequisites:** local Postgres running for backend and e2e tests.
**Estimated effort:** ~3 sessions across 4 phases.

## Open Risks & Assumptions

- The checkbox changes the `workout-ui` screenshots; only the Windows baselines can be refreshed locally, so the Linux ones need regeneration on CI.
- The stats row text "N to failure" is my wording and Polish phrasing ("do upadku") may need your review.

## Success Criteria (Summary)

- A set can be logged to failure and is marked in the active list, history and the previous-workout hint.
- The stats page shows failure counts per parent and muscle; nothing else in the app changes behaviour.
- Backend and full e2e suites pass with only the expected baseline changes.
