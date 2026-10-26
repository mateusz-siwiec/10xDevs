# User-Defined Training Plan — Plan Brief

> Full plan: `context/changes/user-defined-training-plan/plan.md`

## What & Why

Build roadmap slice S-02 (PRD FR-009): a logged-in user creates several named training plans, each a plain ordered list of catalog exercises, edits them (add, remove, reorder) and deletes them after confirming. The PRD requires the plan to stay a simple ordered list with no template structure so the future recommender (FR-013) and plan-driven sessions (S-06) can build on it without rework.

## Starting Point

Auth (F-01), the seeded exercise catalog (F-02) and the workout logging loop (S-01) are done. There is no plan code in the backend, the Topbar has no navigation, and `/` is the only gated route. Production runs Flyway off with `ddl-auto=update`.

## Desired End State

From the web app on a phone-sized screen, a user opens Plans from the Topbar, creates a named plan, adds exercises (the same one may appear twice), reorders with up/down buttons, saves, reopens and edits it, and deletes it after a confirmation. Validation errors appear inline without losing the form. Other users can never see or change these plans.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Plans per user | Many named plans | Matches how people train and avoids a rework for FR-013 | Plan |
| Plan format | Plain ordered list; duplicates allowed; no per-entry targets | PRD resolution on FR-009; avoids special-case rules | PRD / Plan |
| Edit API | `POST`/`PUT` send the full ordered exercise-id list; server rewrites entries atomically | One atomic call; reorder/remove need no extra endpoints | Plan |
| Reordering | Up/down buttons | Big tap targets on a phone, no new dependency | Plan |
| Limits | Name 1–60 chars (duplicates allowed), 1–50 exercises | Blocks empty/abusive plans without friction | Plan |
| Navigation | Topbar links + `/plans`, `/plans/new`, `/plans/:id` | Reuses the existing shell; gives S-06 a place to link | Plan |
| Delete | Hard delete with inline confirm | PRD NFR: destructive actions need explicit confirmation | PRD / Plan |
| Cross-user access | Owner-scoped queries; foreign ids return 404 | Same guardrail and pattern as S-01 | Plan |
| Production | Not deployed; V5 constraints exist only where Flyway runs | Flyway-in-prod is a separate pending decision | Plan |

## Scope

**In scope:** V5 schema, plan CRUD API with validation and isolation tests, Topbar navigation, plan list with delete, plan editor with up/down reorder.

**Out of scope:** linking plans to workout sessions or navigation (S-06), per-entry sets/reps targets, templates/recommender (S-07), clone/archive, drag-and-drop, sharing/import, unsaved-changes guard, enabling Flyway in production, frontend test runner.

## Architecture / Approach

New `plan` package: `training_plans` plus ordered `training_plan_entries` (own id, exercise id, position, unique per plan and position). Service methods are transactional and owner-scoped; edits replace the whole entry list in one transaction (clear and flush before re-adding to avoid the unique-position clash). Frontend adds a typed client, Topbar links, a plans list page and one editor page that edits a local ordered list and saves it in a single call.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data model | V5 migration, entities, repository, schema test | Unique-position constraint vs. Hibernate flush order on replace |
| 2. Plan API | Owner-scoped list/get/create/replace/delete with validation and tests | Replacing entries atomically; isolation correctness |
| 3. Frontend plan list and navigation | Client, Topbar links, `/plans` list with confirmed delete | Topbar change touches every gated page |
| 4. Frontend plan editor | `/plans/new` and `/plans/:id` with picker, up/down, remove, save | Local-state editing of duplicates and order |

**Prerequisites:** F-01 and F-02 done (they are); local Postgres via `podman-compose.yml` for the manual runs.
**Estimated effort:** ~2–3 sessions across 4 phases (two backend, two frontend).

## Open Risks & Assumptions

- Entries get new ids on every save; later slices (S-06) must reference the plan and read entries by position, not entry id.
- V5 constraints will not exist in production while Flyway stays off.
- Plans do not yet affect workouts; users may expect "start from plan" until S-06 lands.

## Success Criteria (Summary)

- A user can create, edit, reorder, and delete named plans of catalog exercises from the web app on a phone-sized screen.
- Deleting a plan requires explicit confirmation; validation errors show inline without losing input.
- Another user can never list, read, change or delete a plan they don't own.
