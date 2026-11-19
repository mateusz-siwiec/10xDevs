# Secondary Muscle Stats — Plan Brief

> Full plan: `context/changes/secondary-muscle-stats/plan.md`

## What & Why

The sets-per-muscle-group page counts every set for the primary muscle of its exercise only, so a lifter cannot see the work their secondary muscles get (triceps from presses, traps from rows). We add an "Include secondary muscles" checkbox, off by default, that also counts each set for those muscles.

## Starting Point

Secondary muscles are already stored per exercise, and the stats endpoint groups sets by primary muscle only. Parent rows (Chest, Back, Shoulders, Arms, Legs, Core) exist only in the frontend, which sums their sub-rows. An uncommitted first draft on `feat/chest-regions` already has the request parameter, a checkbox, strings and one test, but its parent rows would double-count.

## Desired End State

Ticking the box reloads the page with secondary muscles counted: sub-rows count every set that trained that muscle, parent rows count each set once, and the "N sets in total" line does not change. With the box off, the page and API behave exactly as today. The README describes both modes.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Parent rows with secondaries on | Distinct sets per parent, computed by the backend | One press that trains two shoulder muscles must not read as 2 sets of Shoulders. |
| Total line | Stays the number of sets logged | It is the same number in both modes, so it stays honest and comparable. |
| Control and persistence | Native checkbox, off on every visit | Already accessible and built; matches how expanded parents reset. |
| Weighting of secondary muscles | Full set (1) | Counts stay whole numbers, consistent with "sets" and "to failure". |
| Counting approach | One query per exercise, expanded to muscles and parents in memory | Gives groups and distinct parents in one pass without per-muscle queries. |
| API shape | Add `parents` to the response; `includeSecondary` optional, default false | Additive, so existing callers are unaffected. |
| Draft code | Keep param, checkbox, strings, CSS; replace the two repository queries | The draft's counting does not meet the parent-row decision. |

## Scope

**In scope:** per-exercise aggregate query, backend parent mapping, `parents` in the response, frontend parent rows from the API, checkbox states, en/pl strings, backend and e2e tests, README section 5.

**Out of scope:** half-weighting, persisting the choice, segmented-toggle styling, hiding the total line, dashboard or history changes, any database migration.

## Architecture / Approach

The repository returns set and failure-set counts per exercise. The service loads those exercises with their secondary muscles and, for each, adds the counts to the primary muscle, to each secondary muscle when the flag is on, and once to each distinct parent of those muscles. The response carries `groups`, `parents` and `totalSets` (the sum of logged sets). The page reads parent figures from `parents` and keeps its own hierarchy for order and labels. A test pins the backend parent mapping to the frontend one.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Backend counting by exercise and parent | New query, parent mapping, `parents` in the response, controller tests | Backend and frontend parent lists drifting apart |
| 2. Frontend toggle and parent rows | Parent rows from the API, checkbox states, en/pl e2e coverage | Visual baselines or locators changing on this page |
| 3. Docs and full verification | README section 5 updated, full backend and e2e suites green | Unrelated e2e flakiness or baseline diffs |

**Prerequisites:** Postgres running locally for backend tests (Testcontainers) and e2e; `CI` unset for e2e.
**Estimated effort:** ~1-2 sessions across 3 phases.

## Open Risks & Assumptions

- The parent list is duplicated in Java and TypeScript; `MuscleGroupParentTest` is the guard, so adding a muscle group later means updating both.
- Assumes sets with no exercise row stay skipped, as today.
- Assumes the e2e visual baselines for the dashboard are unaffected by one extra line on this page; if not, the delta is explained before any baseline changes.

## Success Criteria (Summary)

- With the box ticked, no parent row shows more sets than were actually done for its muscles, and sub-rows show every muscle trained.
- With the box off, numbers are identical to today.
- All backend, frontend and e2e suites pass and the README matches the behaviour.
