<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Dashboard Insights

- **Plan**: context/changes/dashboard-insights/plan.md
- **Scope**: Full plan (3 of 3 phases)
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-28
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Success criteria re-run during review: `./mvnw test` 187 tests, 0 failures; `npm run lint` 0 errors (2 pre-existing warnings in AuthContext.tsx); `npm run build` OK. All manual items are ticked and were confirmed by the user.

## Findings

### F1 — Goal save reports failure when only the follow-up refetch fails

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/DashboardPage.tsx (handleSaveGoal)
- **Detail**: If `setWeeklyGoal` succeeds but the following `getDashboardInsights()` fails, the user sees "Failed to save goal" although the goal was saved. The card then shows stale streak data. The refetch also has no cancelled guard.
- **Fix**: Separate the two error paths: treat the PUT result as success (apply the returned goal locally) and refetch insights best-effort.
- **Decision**: FIXED (applies saved goal locally if only the refetch fails)

### F2 — Insights scan the user's whole history on every load

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/main/java/com/example/gymtrack/workout/DashboardService.java (insights, `findEndedBetween(userId, EPOCH, now)`); PersonalRecordService.recentRecords + WorkoutSetRepository.findEligibleSetsOfEndedSessions
- **Detail**: Insights loads every ended session as an entity (only for the streak beyond 12 weeks) and every eligible set ever logged (with join fetch) just to return 5 records. Cost grows with total history. The plan's "Performance Considerations" accepts this at current volumes, so this is a tracked trade-off rather than a defect.
- **Fix A ⭐ Recommended**: Leave as is and record the threshold in the plan/roadmap as a follow-up
  - Strength: Matches the plan's explicit decision; no added complexity for an MVP with small per-user data.
  - Tradeoff: Latency and memory degrade for very heavy users.
  - Confidence: MEDIUM — no measurements of real per-user volumes.
  - Blind spot: Actual history sizes of the dev/prod accounts.
- **Fix B**: Use lean projections (endedAt/id; session id, exercise id, reps, weight, loggedAt) instead of entities, and bound the streak scan
  - Strength: Cuts memory without changing behaviour.
  - Tradeoff: More query code; streak cap or grouped query needed to bound it.
  - Confidence: MEDIUM — projection change is safe, bounding streak changes semantics.
  - Blind spot: Haven't profiled where time actually goes.
- **Decision**: ACCEPTED via Fix A (left as is; queued in follow-ups/review-fixes.md)

### F3 — Delta colors hard-coded, no dark-mode variant

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/styles/dashboard.css:64,68
- **Detail**: `.dashboard-delta` uses `#1a7f37` / `#cf222e` directly. Elsewhere the app uses tokens from index.css (`--danger` exists), which have dark-theme overrides; the hard-coded red has marginal contrast on the dark background.
- **Fix**: Add success/danger tokens with dark variants in index.css and use them in dashboard.css.
- **Decision**: FIXED (added --success token with dark variant; down uses --danger)

### F4 — Recent records use a global running best, History uses a per-session baseline

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/main/java/com/example/gymtrack/workout/PersonalRecordService.java (recentRecords vs personalRecordSetIds)
- **Detail**: History flags a set using the best score among sets before the session's `startedAt`; `recentRecords` scans all eligible sets by `loggedAt` with a running best. They agree for normal use, but can differ for overlapping sessions or backdated/edited sets, so Dashboard and History could disagree in edge cases. The parity test covers only the normal case.
- **Fix A ⭐ Recommended**: Add a parity test with overlapping/backdated sessions to learn whether the edge case is real
  - Strength: Cheap and turns a suspicion into evidence before changing the algorithm.
  - Tradeoff: May reveal a mismatch that needs a bigger fix.
  - Confidence: MEDIUM — depends on whether overlap is possible given the one-active-session constraint.
  - Blind spot: Whether sets can be backdated through any API.
- **Fix B**: Reuse the per-session baseline logic inside recentRecords
  - Strength: Guarantees identical flags.
  - Tradeoff: Likely N queries or a more complex query; loses the single-scan simplicity.
  - Confidence: LOW — not prototyped.
  - Blind spot: Performance impact.
- **Decision**: FIXED via Fix A, with a different outcome: investigated instead of adding a test. loggedAt/startedAt have no setters and are assigned only at creation, and one active session per user is enforced, so overlapping or backdated sessions cannot be produced through the API and the two rules cannot diverge. A test would have to assert an unreachable divergence, so the invariant is documented in recentRecords javadoc.

### F5 — Block-boundary comment disagrees with the bucketing math

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/main/java/com/example/gymtrack/workout/DashboardService.java (insights javadoc / block index)
- **Detail**: The comment says block k is `[now-(k+1)*7d, now-k*7d)`, but the floor-division bucketing yields `(now-(k+1)*7d, now-k*7d]`. A session ending exactly 7 days before `now` lands in block 1, while stats counts it in the current 7-day window. Practically unreachable.
- **Fix**: Align the comment (or the math) with the half-open convention used by the stats windows.
- **Decision**: FIXED (bucketing now matches the documented half-open block)

### F6 — PUT weekly-goal returns 500 for a deleted user with a valid token

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/main/java/com/example/gymtrack/workout/DashboardService.java (setWeeklyGoal, `orElseThrow()`)
- **Detail**: `orElseThrow()` surfaces as a 500 if the user row no longer exists; a `ResourceNotFoundException` sibling exists.
- **Fix**: Throw the existing not-found exception so the handler returns 404.
- **Decision**: FIXED (ResourceNotFoundException -> 404)

### F7 — Weekly volume chart has no text alternative

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/components/WeeklyVolumeChart.tsx
- **Detail**: The Recharts SVG gives screen-reader users nothing. ProgressionChart has the same gap, so this follows the existing pattern.
- **Fix**: Add an `aria-label`/summary on the chart wrapper.
- **Decision**: FIXED (role=img wrapper with aria-label summary)

### F8 — Production note for the new weekly_goal column

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: CLAUDE.md (Architecture, Flyway/production note)
- **Detail**: Production skips Flyway; `ddl-auto=update` will add the nullable column, so no manual SQL is required. The plan states this, but nothing in CLAUDE.md records that V9 is safe to leave to Hibernate.
- **Fix**: Optional one-line note; skip if it is already clear from the plan.
- **Decision**: FIXED (one-line note in CLAUDE.md)

### F9 — Goal input draft does not resync; no retry for a failed insights load

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/components/ConsistencyCard.tsx; frontend/src/pages/DashboardPage.tsx
- **Detail**: `draft` is initialised from `streak.goal` only on mount, and insights load only on mount with no retry after an error. Neither affects the planned flows.
- **Fix**: Optionally add a retry button and resync the draft when the server goal changes.
- **Decision**: FIXED (Retry button for failed insights load; card keyed by goal so the draft resyncs)
