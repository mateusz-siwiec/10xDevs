# Personal Record Flag Implementation Plan

## Overview

Flag a logged set as a new personal record (PR) when its estimated one-rep max (1RM) beats every earlier set the user logged for that exercise (PRD FR-014, roadmap S-08). The flag is derived on read and exposed as a `personalRecord` boolean on set payloads; the UI shows a "PR" badge in the live session set list and in the workout history detail.

## Current State Analysis

- A set is `WorkoutSet(session, exerciseId, reps, weightKg, loggedAt)`; it carries no derived data. `SetResponse` (`id, exerciseId, reps, weightKg, loggedAt`) is built in `WorkoutService.logSet` and `WorkoutService.toResponse` (via `SessionResponse.from`). The history detail set shape `HistoryDetailResponse.SetEntry(reps, weightKg)` is built in `HistoryService.detail`.
- Only one session per user can be active (partial unique index `uq_workout_sessions_active_per_user`), and sets can only be logged while a session is active. Therefore every set from an earlier session has `loggedAt` before the current session's `startedAt`.
- Sets are deletable while the session is active (`WorkoutService.deleteSet`). `WorkoutPage.handleDelete` removes the set from client state locally and does not refetch.
- `ProgressionRecommendationService` is the precedent for a deterministic, read-only rule: named constants, no stored state, computed per request.
- The frontend has no test runner (`npm run lint`, `npm run build` only). Backend integration tests use Testcontainers + MockMvc (`WorkoutSetControllerTest`).

## Desired End State

- `POST /api/workout-sessions/{id}/sets`, `GET /api/workout-sessions/current`, `POST .../end` return sets with `personalRecord`; `GET /api/workout-sessions/{id}` (history detail) returns each set with `personalRecord`.
- A set is flagged iff it has at most 15 reps, an earlier eligible set exists for the same exercise (same user, this or a past session), and its score is strictly greater than the best score among those earlier sets.
- The live workout page and the history detail page show a "PR" badge on flagged sets. Deleting a set during a workout re-evaluates the flags of the remaining sets.
- Verified by the new backend integration tests, `npm run lint` / `npm run build`, and the manual checks below.

### Key Discoveries:

- `src/main/java/com/example/gymtrack/workout/WorkoutService.java:94-104` — `logSet` builds the response from the saved set; `:130-132` `toResponse` builds `SessionResponse` for start/current/end.
- `src/main/java/com/example/gymtrack/workout/HistoryService.java:84-103` — `detail` groups sets per exercise into `SetEntry`.
- `src/main/java/com/example/gymtrack/workout/ProgressionRecommendationService.java:16-47` — pattern: javadoc names the FR and the heuristic, constants are `static final`, service is `@Transactional(readOnly = true)`.
- `src/main/java/com/example/gymtrack/workout/WorkoutSetRepository.java:21-29` — aggregate JPQL with `select new ...Response(...)` is the repository pattern for derived numbers.
- `src/main/resources/db/migration/V4__create_workout_sessions_and_sets.sql` — `idx_workout_sets_exercise_id` already supports a per-exercise baseline query; no migration is needed.
- `frontend/src/pages/WorkoutPage.tsx:174-190` — `handleDelete` filters locally; with a derived flag this leaves stale badges.

## What We're NOT Doing

- No stored flag, new column or migration (production skips Flyway, and a stored flag goes stale on delete).
- No profile-level or per-exercise "records" page, record history or PR celebration/toast.
- No alternative 1RM formulas and no user setting for the rep cutoff.
- No flag on `PreviousWorkoutResponse` hints, the progression chart, the dashboard or the history list.
- No handling of unweighted/bodyweight sets (weight must be > 0 today).

## Implementation Approach

Epley's estimate is `weight × (1 + reps/30)`. To avoid division and rounding, compare the exact score `weight × (30 + reps)` (Epley × 30). A new `PersonalRecordService` takes a session and its sets (ordered by `loggedAt`), loads one baseline score per exercise from earlier sessions with a grouped query, then walks the session's sets in order keeping a running best per exercise. Sets above 15 reps are skipped entirely (not flagged, not counted in the baseline or the running best). The first eligible set for an exercise with no baseline is not flagged but seeds the running best. Ties are not records. All set payloads that list a session's sets call this one service, so the live and history views cannot disagree. The frontend only renders the field and refetches the session after a delete.

## Phase 1: Backend — PR rule and API

### Overview

Add the rule, the baseline query and the `personalRecord` field to every response that lists sets, with integration tests.

### Changes Required:

#### 1. Baseline query

**File**: `src/main/java/com/example/gymtrack/workout/WorkoutSetRepository.java` (plus a small result record, e.g. `ExerciseScore`, in the same package)

**Intent**: Return, per exercise, the best score among the user's eligible sets logged before a cutoff, so history never has to be loaded into memory.

**Contract**: `List<ExerciseScore> findBestScoresBefore(UUID userId, Collection<UUID> exerciseIds, int maxReps, Instant before)` where `ExerciseScore(UUID exerciseId, BigDecimal score)`; JPQL groups by `s.exerciseId` and selects `max(s.weightKg * (30 + s.reps))` filtered by `s.session.userId = :userId`, `s.exerciseId in :exerciseIds`, `s.reps <= :maxReps`, `s.loggedAt < :before`. The caller passes the session's `startedAt` as `before`. Confirm the `max(...)` expression returns `BigDecimal` under the project's Hibernate version; adapt the record type if it does not.

#### 2. Rule

**File**: `src/main/java/com/example/gymtrack/workout/PersonalRecordService.java` (new)

**Intent**: Single place that decides which of a session's sets are personal records. Javadoc names FR-014, the Epley score, the 15-rep eligibility cutoff, strict "greater than", and the known limitation that 1RM estimates are least reliable at higher reps (as in `ProgressionRecommendationService`).

**Contract**: `static final int MAX_ELIGIBLE_REPS = 15`; `Set<UUID> personalRecordSetIds(WorkoutSession session, List<WorkoutSet> sets)` — `sets` are the session's sets in `loggedAt` order, returns the ids of flagged sets. Sets with `reps > MAX_ELIGIBLE_REPS` never appear in the result and never update the baseline. Score is `weightKg × (30 + reps)` as `BigDecimal`; comparison is `compareTo`. A set is flagged only when a baseline or earlier in-session eligible score for its exercise exists and the set's score is strictly greater. Must be called inside the caller's transaction; the service is not itself a transaction boundary.

#### 3. Set payloads

**Files**: `SetResponse.java`, `SessionResponse.java`, `WorkoutService.java`, `HistoryDetailResponse.java`, `HistoryService.java` (all in `src/main/java/com/example/gymtrack/workout/`)

**Intent**: Surface the flag everywhere a session's sets are returned, computed by one service call per response.

**Contract**:
- `SetResponse` gains `boolean personalRecord`; `SetResponse.from(WorkoutSet, boolean)`.
- `SessionResponse.from(WorkoutSession, List<WorkoutSet>, Set<UUID> personalRecordSetIds)`.
- `WorkoutService.toResponse` and `logSet` obtain the ids from `PersonalRecordService` using the session's current sets (for `logSet`, the list that includes the just-flushed set, then pick the new set's flag).
- `HistoryDetailResponse.SetEntry(int reps, BigDecimal weightKg, boolean personalRecord)`; `HistoryService.detail` computes ids once for the session's sets.
- `PreviousWorkoutResponse.SetEntry` is intentionally unchanged.

#### 4. Tests

**File**: `src/test/java/com/example/gymtrack/workout/PersonalRecordControllerTest.java` (new; same `@SpringBootTest` + MockMvc + Testcontainers setup as `WorkoutSetControllerTest`)

**Intent**: Pin the agreed definition of a record through the real API.

**Contract** — scenarios (weights in kg × reps):
- First-ever set of an exercise is not flagged; a later set with higher score is (e.g. 3×60 then 5×60 → second flagged).
- Tie is not flagged (5×60 twice → neither flagged).
- A set with 16+ reps is never flagged and does not raise the baseline (5×60, then 20×60 unflagged, then 6×60 flagged).
- Cross-session: 5×60 in a finished session; in the next session 5×60 is not flagged and 5×65 is. Another user's heavier sets do not affect the baseline.
- Different exercises have independent baselines.
- The `logSet` response, `GET /current` and history detail report identical flags for the same sets.
- Deleting a flagged set re-evaluates the remaining sets: log 5×60, 5×65 (flagged), 5×62.5 (not flagged, below 5×65); after deleting 5×65 the 5×62.5 set is flagged because it now beats 5×60.

### Success Criteria:

#### Automated Verification:

- New tests pass: `./mvnw test -Dtest=PersonalRecordControllerTest`
- Full backend suite passes (existing responses stay compatible): `./mvnw test`

#### Manual Verification:

- With the API running (`local` profile), logging a heavier set via the API returns `"personalRecord": true`, a lighter one `false`.
- `GET /api/workout-sessions/{id}` for an ended session returns the same flags the live session showed.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Frontend — PR badge

### Overview

Render the flag and keep it correct after a delete.

### Changes Required:

#### 1. API types

**File**: `frontend/src/api/client.ts`

**Intent**: Mirror the new response field.

**Contract**: `WorkoutSet` gains `personalRecord: boolean`; the `HistoryDetail.exercises[].sets[]` element type gains `personalRecord: boolean`.

#### 2. Badge in the live session list

**Files**: `frontend/src/components/SessionSetList.tsx`, `frontend/src/styles/page.css`

**Intent**: Show a small "PR" badge next to a flagged set. The badge style lives in `page.css` because both the workout and history pages import it.

**Contract**: a `.pr-badge` element rendered when `set.personalRecord`, with an accessible name such as "New personal record" (visible text "PR"); styling follows existing CSS variables in `page.css`.

#### 3. Badge in the history detail

**File**: `frontend/src/pages/HistoryDetailPage.tsx`

**Intent**: Same badge on the set line in the history detail, matching what the live list showed.

**Contract**: the `<li>` for a set renders `.pr-badge` after "Set N: reps × weight kg" when `set.personalRecord`.

#### 4. Refetch after delete

**File**: `frontend/src/pages/WorkoutPage.tsx`

**Intent**: Deleting a set can change which remaining sets are records, so after a successful `deleteSet` reload the session instead of only filtering locally. Appending a set never changes earlier flags, so `handleLog` stays as is.

**Contract**: in `handleDelete`, after `deleteSet` resolves call `getCurrentSession()` and `setSession` with the result; if the refetch fails, fall back to the existing local filter so the UI still reflects the successful delete. Existing `setRefreshKey` bump stays.

### Success Criteria:

#### Automated Verification:

- Linting passes: `cd frontend && npm run lint`
- Type check and build pass: `cd frontend && npm run build`

#### Manual Verification:

- Start a workout, log 5×60 (no badge), then 5×65: the second set shows "PR" immediately.
- Delete the 5×65 set: the remaining set shows no badge; re-logging 5×65 shows it again.
- Log a 20-rep set heavier by estimate: no badge.
- End the workout, open it from History: the same sets show "PR", and a later workout with a tie shows none.
- Badge is readable on a phone-width viewport and does not wrap the set row awkwardly.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

- No separate unit tests; the rule is exercised end to end through `PersonalRecordControllerTest` because the baseline query and the in-memory walk are the behavior under test.

### Integration Tests:

- All scenarios listed in Phase 1, change 4.

### Manual Testing Steps:

1. Run the API (`./mvnw spring-boot:run -Dspring-boot.run.profiles=local`) and the SPA (`npm run dev`).
2. Follow the Phase 2 manual checklist, including the history view and the delete-then-re-evaluate step.
3. Log sets for two different exercises in one workout and confirm badges are independent.

## Performance Considerations

The baseline is a single grouped query per response, served by `idx_workout_sets_exercise_id`, and the in-session walk is linear in the session's sets. History size does not affect memory. No caching is needed at MVP scale.

## Migration Notes

None. The flag is derived on read: no schema change, no backfill, and nothing to apply by hand on the Supabase DB (where Flyway is disabled). Known limitation to keep documented in the service javadoc: 1RM estimates are least reliable at higher reps, which is why sets above 15 reps are ignored.

## References

- PRD: `context/foundation/prd.md` (FR-014, line ~143)
- Roadmap: `context/foundation/roadmap.md` (S-08)
- Rule precedent: `src/main/java/com/example/gymtrack/workout/ProgressionRecommendationService.java:16-122`
- Test precedent: `src/test/java/com/example/gymtrack/workout/WorkoutSetControllerTest.java`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend — PR rule and API

#### Automated

- [x] 1.1 New tests pass: `./mvnw test -Dtest=PersonalRecordControllerTest` — 0bae371
- [x] 1.2 Full backend suite passes (existing responses stay compatible): `./mvnw test` — 0bae371

#### Manual

- [x] 1.3 With the API running (`local` profile), logging a heavier set via the API returns `"personalRecord": true`, a lighter one `false` — 0bae371
- [x] 1.4 `GET /api/workout-sessions/{id}` for an ended session returns the same flags the live session showed — 0bae371

### Phase 2: Frontend — PR badge

#### Automated

- [x] 2.1 Linting passes: `cd frontend && npm run lint` — b69239b
- [x] 2.2 Type check and build pass: `cd frontend && npm run build` — b69239b

#### Manual

- [x] 2.3 Start a workout, log 5×60 (no badge), then 5×65: the second set shows "PR" immediately — b69239b
- [x] 2.4 Delete the 5×65 set: the remaining set shows no badge; re-logging 5×65 shows it again — b69239b
- [x] 2.5 Log a 20-rep set heavier by estimate: no badge — b69239b
- [x] 2.6 End the workout, open it from History: the same sets show "PR", and a later workout with a tie shows none — b69239b
- [x] 2.7 Badge is readable on a phone-width viewport and does not wrap the set row awkwardly — b69239b
