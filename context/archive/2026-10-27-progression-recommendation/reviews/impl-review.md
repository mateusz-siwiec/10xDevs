<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Progression Recommendation

- **Plan**: context/changes/progression-recommendation/plan.md
- **Scope**: Full plan (Phases 1–2 of 2)
- **Reviewed phases**: 1, 2
- **Date**: 2026-10-27
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Success criteria evidence (re-run during this review): `./mvnw test` → 97 tests, 0 failures (new class: 15 tests); `npm run build` exit 0; `npm run lint` exit 0 (2 pre-existing warnings in `AuthContext.tsx`). Manual items 1.3/1.4 were verified against a live backend (200 with 61.5, 204 cases); 2.3–2.6 were confirmed by the user.

## Findings

### F1 — Live region mounted already filled, so it may not be announced

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/components/ProgressionRecommendation.tsx:36
- **Detail**: `aria-live="polite"` sits on a `<section>` that only mounts once the recommendation exists, so screen readers usually do not announce it. `SubstituteSuggestions.tsx` keeps a stable live container. (Related, deliberate: the `.catch` swallows all errors, including a 401, because the hint is advisory.)
- **Fix**: Render a persistent empty `<div aria-live="polite">` wrapper and put the section inside it, or drop `aria-live`.
- **Decision**: FIXED — persistent `aria-live` wrapper in `ProgressionRecommendation.tsx`

### F2 — Session ordering has no unique tiebreaker

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/main/java/com/example/gymtrack/workout/WorkoutSessionRepository.java:21
- **Detail**: `order by s.endedAt desc, s.startedAt desc` is non-deterministic if two sessions share both timestamps. Practically impossible (one active session per user), but free to make deterministic.
- **Fix**: Append `, s.id desc` to the order clause.
- **Decision**: FIXED — `s.id desc` appended in `WorkoutSessionRepository.java`

### F3 — Untested edge cases: duplicate exercise in a plan, exact `endedAt` tie, foreign plan

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: src/test/java/com/example/gymtrack/workout/ProgressionRecommendationControllerTest.java
- **Detail**: With the same exercise twice in a plan (e.g. 3×10 then 2×8) only the first entry (lowest position) is the target while sets from both occurrences are pooled into the working sets. This is documented in the service Javadoc but no test pins it; a session whose `planId` points to another user's plan (returns 204) and an exact `endedAt` tie are also unpinned.
- **Fix**: Add tests for the duplicate-exercise behaviour and the foreign-plan case so the documented limitations cannot change silently.
  - Strength: Locks the documented behaviour at near-zero cost.
  - Tradeoff: Tests encode a limitation that a later slice might want to change.
  - Confidence: HIGH — behaviour is read directly from the service.
  - Blind spot: Whether the pooled-sets behaviour is what you want long term.
- **Decision**: FIXED — added `duplicateExerciseInPlanUsesTheFirstEntryAsTarget` and `sessionsOfAnotherUsersPlanGiveNoRecommendation` (the exact `endedAt` tie stays untested; the `s.id desc` tiebreaker from F2 makes it deterministic)
