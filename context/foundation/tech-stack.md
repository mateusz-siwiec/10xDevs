---
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
---

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
