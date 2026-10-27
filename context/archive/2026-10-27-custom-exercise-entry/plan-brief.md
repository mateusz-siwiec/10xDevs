# Custom Exercise Entry — Plan Brief

> Full plan: `context/changes/custom-exercise-entry/plan.md`

## What & Why

Users can add their own exercises (name, muscle group) when the seeded catalog doesn't have what they train (roadmap S-05, PRD FR-003). Custom exercises are private to their owner, as the PRD's access-control section requires.

## Starting Point

The `exercises` table is global seed data with no owner, and the only exercise endpoints are reads (list and substitutes). Several services accept an exercise id with a plain existence check, so today any id would work for any user — fine for a shared catalog, a leak once exercises can be private. Used exercises are referenced by plan entries and logged sets with no cascade.

## Desired End State

An "Exercises" topbar link opens a page to add a custom exercise (name, primary group, optional secondary groups) and delete it while unused. It appears in the workout and plan pickers and in same-group substitutes for its owner only; duplicates are refused; used exercises cannot be deleted; nobody else can see or use it.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Visibility | Private to the owner (`owner_id`, null = catalog) | PRD access control: every user manages only their own custom exercises. |
| Management | Create and delete; no rename | Fixes typos by recreate without silently rewriting history; delete refused (409) when used. |
| Duplicate names | Block vs catalog and own (case-insensitive, trimmed) | Pickers and charts never show two identical entries. |
| UI | Dedicated "My exercises" page | One clear place for management; no changes to the workout flow. |
| Muscle groups | Primary required, secondary optional | Same shape as catalog exercises; chosen by the user. |
| Not-yours response | 404, never 403 | Does not reveal that someone else's exercise exists. |
| Slug | Generated `custom-<uuid>` | Keeps the unique non-null slug column unchanged. |
| Delete check | Explicit usage queries (plans, sets) | Predictable 409 message instead of catching an FK violation. |

## Scope

**In scope:** migration and entity, create/list/delete API, visibility rule in all existing exercise lookups, substitutes, "My exercises" page and topbar link.

**Out of scope:** rename/edit, inline add in pickers, per-user cap, sharing or promoting to the catalog, soft-delete, changes to catalog data.

## Architecture / Approach

One nullable `owner_id` column marks custom rows, so existing foreign keys and joins keep working. The list endpoint returns catalog plus own exercises with a `custom` flag; a new service owns create/delete rules; every existing lookup by exercise id switches to a "visible to this user" check. Backend lands in two phases (data + API, then the visibility sweep with isolation tests) before the single new page.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data and API | Migration, entity, create/list/delete with name rules and tests | Matching the entity to the migration (production uses `ddl-auto=update`, Flyway off) |
| 2. Visibility everywhere | All lookups and substitutes scoped to catalog + own, isolation tests | Missing one lookup path and leaking another user's exercise |
| 3. "My exercises" page | `/exercises` page, add form, delete, topbar link | Surfacing 409/400 messages inline; picker refresh after add |

**Prerequisites:** F-01 and F-02 (both done).
**Estimated effort:** ~2–3 sessions across 3 phases.

## Open Risks & Assumptions

- The partial unique index on own names exists only in the Flyway migration; in production (`ddl-auto=update`, Flyway off) the service-level duplicate check is the only guard (accepted; a concurrent double-submit could create a duplicate).
- A used custom exercise can never be removed (no rename or archive either); accepted for a nice-to-have slice.
- Pickers show custom and catalog exercises in one alphabetical list without a marker; acceptable because duplicate names are blocked.

## Success Criteria (Summary)

- A custom exercise can be created, used in a workout and a plan, and deleted only while unused.
- Another account never sees or can use it — 404 on every path that takes an exercise id.
- Duplicate and catalog names are refused with a clear message.
