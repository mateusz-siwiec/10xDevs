---
bootstrapped_at: 2026-10-13T16:37:57Z
starter_id: spring
starter_name: Spring Boot
project_name: gym-track
language_family: java
package_manager: maven
cwd_strategy: subdir-then-move
bootstrapper_confidence: verified
phase_3_status: ok
audit_command: "null"
---

## Hand-off

```yaml
starter_id: spring
package_manager: maven
project_name: gym-track
hints:
  language_family: java
  team_size: solo
  deployment_target: fly
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: verified
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

## Why this stack

A solo developer building a small, after-hours MVP (3-week budget, small user
scale) with login/registration (email+password/OAuth/passwordless) needs a
battle-tested, agent-friendly backend. Spring Boot is the recommended default
for `(web-app, java)` and clears all four agent-friendly gates (typed,
convention-based, popular in Java training data, well documented); its
bootstrapper confidence is verified, so scaffolding will be smooth. Auth is
in scope per FR-001; payments, realtime, AI, and background jobs are not used
by any FR and are flagged false. Deployment targets Fly (the card's first
default); CI runs on GitHub Actions with auto-deploy-on-merge.

Note: `spring` is backend-only; this hand-off's schema has no frontend slot,
so the frontend choice is recorded here in prose only, not in frontmatter.
Frontend: React + TypeScript SPA via Vite, calling the Spring Boot REST API.
Chosen over Thymeleaf (avoids Java-coupled server-side templating, which the
user explicitly wants to avoid) and over Vue (React has the largest
training-data footprint of mainstream frontend frameworks, which matters most
here since the user is new to both and leans on AI-agent-written code).
`/10x-bootstrapper` only scaffolds the `spring` backend from this file's
frontmatter; the React frontend is a separate scaffold step to request
explicitly (e.g. `npm create vite@latest frontend -- --template react-ts`),
either during or after backend bootstrap.

## Pre-scaffold verification

| Signal      | Value                  | Severity | Notes                                                              |
| ----------- | ----------------------- | -------- | ------------------------------------------------------------------- |
| npm package | not run                 | n/a      | non-JS starter (language_family: java) — npm recency check skipped |
| GitHub repo | not run                 | n/a      | card `docs_url` (`https://docs.spring.io/spring-boot/`) is not a github.com URL; no recency signal available |

## Scaffold log

**Resolved invocation**: `curl -s https://start.spring.io/starter.tgz -d dependencies=web,devtools -d type=maven-project -d javaVersion=21 -d groupId=com.example -d artifactId=.bootstrap-scaffold | tar -xzf -` (run inside `.bootstrap-scaffold/`)
**Strategy**: subdir-then-move
**Exit code**: 0
**Files moved**: 9 (8 moved silently, 1 `.gitignore` append-merged)
**Conflicts (.scaffold siblings)**: `src/main/resources/application.properties.scaffold`
**.gitignore handling**: append-merged (existing root lines kept in order, then scaffold's de-duped lines appended under a `# from spring` comment)
**.bootstrap-scaffold cleanup**: deleted

Known quirk worth flagging: because `subdir-then-move` substitutes `{name}` with the literal string `.bootstrap-scaffold`, and the `spring` card's `cmd_template` also uses `{name}` as the Spring Initializr `artifactId` parameter (not just a directory name), the generated `pom.xml` and Java package ended up named after the temp directory rather than the project:
- `pom.xml` `<artifactId>` is `.bootstrap-scaffold`
- Java package is `com.example.bootstrap_scaffold` (dot/dash sanitized to underscore by Spring Initializr)

This is a registry/cmd_template quirk specific to curl-based starters where `{name}` doubles as source-code metadata, not a bootstrapper bug. **Recommended manual fix**: rename the Maven `artifactId` to `gym-track` in `pom.xml` and rename the Java package from `com.example.bootstrap_scaffold` to `com.example.gymtrack` (or similar), moving `Application.java` and `ApplicationTests.java` accordingly.

Also flagged during the chain (tech-stack.md's "Why this stack" note): this repo already had a **Gradle** scaffold (`build.gradle.kts`, `settings.gradle.kts`, `gradlew`) before this run. The `spring` card's `cmd_template` is Maven-only, so the project now has both `pom.xml`/`mvnw` (new) and the pre-existing Gradle files side by side. The user explicitly chose to proceed and remove the Gradle files afterward rather than adapt the scaffold to Gradle or re-pick the stack.

## Post-scaffold audit

**Tool**: skipped — no built-in audit tool for java
**Recommended external tool**: OWASP Dependency-Check or Snyk (run separately against the Maven dependency tree once `pom.xml` is finalized)

## Hints recorded but not acted on

| Hint                     | Value           |
| ------------------------ | --------------- |
| bootstrapper_confidence  | verified        |
| quality_override         | false            |
| path_taken               | standard         |
| self_check_answers       | null             |
| team_size                | solo             |
| deployment_target        | fly              |
| ci_provider              | github-actions   |
| ci_default_flow          | auto-deploy-on-merge |
| has_auth                 | true             |
| has_payments             | false            |
| has_realtime             | false            |
| has_ai                   | false            |
| has_background_jobs      | false            |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep (`src/main/resources/application.properties.scaffold` vs. your existing `application.properties`).
- Rename the Maven `artifactId` (currently `.bootstrap-scaffold`) and the Java package (currently `com.example.bootstrap_scaffold`) to match `gym-track` — see the note under "Scaffold log" above.
- Decide on Gradle vs. Maven: this directory now has both build systems. Remove `build.gradle.kts`, `settings.gradle.kts`, `gradlew`, `gradlew.bat`, and `gradle/` once you've migrated anything you need from them into the new Maven project, or vice versa.
- Scaffold the React + TypeScript frontend separately (e.g. `npm create vite@latest frontend -- --template react-ts`) — this run only bootstrapped the Spring Boot backend.
- Address audit findings per your project's risk tolerance once an external Java dependency-audit tool is wired up — none was run in this bootstrap.
