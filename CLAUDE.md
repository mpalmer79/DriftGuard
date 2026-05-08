# DriftGuard Principal-Level Hardening Prompt

You are acting as a principal engineer and technical product architect.

Your goal is to harden DriftGuard methodically without overlapping work, breaking existing behavior, or creating noisy rewrites. Attention to detail matters more than speed.

## Primary objective

Address the following weaknesses and priority fixes:

1. Remove all SentinelNav branding leftovers and standardize the project as DriftGuard.
2. Strengthen the live app so it feels like an expert operator console, not just a demo.
3. Improve frontend depth so the UI explains causality, decisions, and risk.
4. Review production limitations and make them explicit, bounded, and professionally documented in code/docs where appropriate.
5. Validate bold repo claims against the actual codebase and CI state.
6. Add a clear “What this demonstrates” section to the repo documentation.
7. Improve dashboard causality:
   - previous mode
   - current mode
   - trigger reason
   - active faults
   - vote split
   - detector finding
   - final action
8. Add one architecture diagram file.
9. Add a live demo script showing the scenario flow:
   - run sensor drift scenario
   - observe DEGRADED mode
   - inject controller fault
   - observe SAFE_MODE behavior

Exclude README screenshot/GIF work. Do not add screenshots.

---

# Operating rules

Work in phases. Do not mix unrelated changes.

Use multiple Claude Code agents in parallel, but assign them non-overlapping scopes.

Before editing, inspect the repo structure and identify:
- frontend framework and app paths
- backend framework and app paths
- documentation paths
- test paths
- CI paths
- deployment config paths

Do not guess. Inspect first.

Do not perform broad rewrites unless necessary.

Do not remove tests to make the build pass.

Do not weaken security, validation, deterministic behavior, replay behavior, or simulation correctness.

Do not rename public API fields unless you update all consumers and tests.

Every code change must be supported by tests when reasonable.

Every documentation claim must match the repo as it exists after your work.

---

# Parallel agent assignments

Run these agents in parallel only after initial repo inspection.

## Agent A: Branding and terminology cleanup

Scope:
- Search the entire repo for:
  - SentinelNav
  - sentinelnav
  - Sentinel Nav
  - sentinel-nav
  - old project names or mismatched product references
- Standardize external-facing product name as DriftGuard.
- Preserve historical references only if they are clearly labeled as legacy migration notes.
- Update:
  - app metadata
  - package names only if safe
  - docs
  - page titles
  - OpenGraph metadata
  - API docs text
  - architecture docs
  - deployment docs
  - comments that leak old branding
  - tests that assert visible text

Constraints:
- Do not rename files, modules, packages, or import paths unless the rename is low-risk and all tests are updated.
- Prefer text cleanup over structural rename unless structural rename is clearly necessary.
- If any internal module names remain for compatibility, document why.

Deliverable:
- A concise report listing every file changed and any intentional leftovers.

---

## Agent B: Frontend operator-console upgrade

Scope:
- Inspect the live frontend structure.
- Identify dashboard, scenario, scenario authoring, results, run detail, and navigation pages.
- Improve the app so it better communicates operator-level system behavior.

Required UI improvements:
- Add or improve a dashboard causality panel that clearly shows:
  - previous mode
  - current mode
  - trigger reason
  - active faults
  - vote split
  - detector finding
  - final action
- Add empty states that explain what the user should do next.
- Add inline explanations for safety modes:
  - NORMAL
  - DEGRADED
  - SAFE_MODE
  - FAILED
- Add operator-style labels such as:
  - System State
  - Decision Reason
  - Fault Evidence
  - Controller Vote
  - Final Command
  - Replay Fingerprint
- Improve scenario pages so a reviewer understands the story of each scenario without reading the backend code.

Constraints:
- Do not create fake data if real backend data exists.
- If a field is unavailable from the backend, add a graceful fallback and note the missing backend field in the final report.
- Keep the UI clean and technical.
- Avoid generic marketing copy.
- Avoid large visual redesign unless necessary.
- Preserve mobile responsiveness.
- Preserve existing routing and deployment behavior.

Testing:
- Add or update frontend tests if the repo has a frontend test setup.
- Run type checks and lint checks if available.

Deliverable:
- A report explaining the before and after behavior for each edited page.

---

## Agent C: Backend causality and API review

Scope:
- Inspect backend decision, simulation, scenario, event, incident, metrics, and replay models.
- Determine whether the backend already exposes enough causality data for the frontend.

Required review:
- Confirm whether these fields exist in responses:
  - previous mode
  - current mode
  - trigger reason
  - active faults
  - vote split
  - detector finding
  - final action
- If missing, add minimal, well-typed response fields using existing domain data.
- Do not invent causality. Derive it from actual simulation, voting, detector, and safe-mode state.
- Ensure responses remain deterministic and replayable.
- Ensure added fields do not break existing clients.

Constraints:
- Prefer additive API changes.
- Preserve existing schemas unless a breaking change is unavoidable.
- Update serializers, models, OpenAPI schemas, and tests.
- Do not weaken validation or fault injection protections.

Testing:
- Add or update backend tests proving causality fields are correct for:
  - normal run
  - sensor drift scenario
  - controller disagreement scenario
  - safe-mode escalation
  - replay or deterministic comparison if applicable

Deliverable:
- A field-by-field causality mapping table:
  - field name
  - source domain object
  - endpoint
  - test coverage

---

## Agent D: Production limits and claims audit

Scope:
- Audit repo claims against reality.
- Review README, docs, badges, CI workflows, deployment docs, comments, and app copy.

Required audit:
- Verify claims about:
  - test count
  - coverage percentage
  - TLA+ or formal specification
  - OpenTelemetry
  - supply-chain CI
  - security scanning
  - rate limiting
  - replay fingerprints
  - deterministic simulation
  - SQLite persistence
  - single-replica deployment limits
  - open read endpoints
  - bearer-token proxy
- Adjust wording so claims are accurate and defensible.

Documentation requirements:
- Add or improve a “Production Boundaries” section covering:
  - single replica assumption
  - SQLite deployment limitations
  - in-memory rate limit or registry limitations
  - demo auth boundaries
  - what would be required for multi-tenant production
  - what is intentionally out of scope
- Add or improve a “What this demonstrates” section:
  - deterministic control simulation
  - redundant controller voting
  - fault injection
  - safe-mode escalation
  - replayability
  - audit logging
  - operator-facing explainability
  - CI-backed engineering discipline

Constraints:
- Do not exaggerate.
- Do not remove strong claims if they are true.
- Replace vague claims with specific, verifiable ones.

Deliverable:
- A claim audit table:
  - original claim
  - true, partially true, false, or unverifiable
  - action taken
  - file changed

---

## Agent E: Architecture diagram and live demo script

Scope:
- Create one architecture diagram file and one live demo script document.

Architecture diagram requirements:
- Add a repo-native diagram file.
- Prefer Mermaid if the repo already uses Markdown docs.
- Diagram should show:
  - frontend
  - API layer
  - scenario runner
  - simulation orchestrator
  - sensor model
  - redundant controllers
  - voter
  - detector
  - safe-mode manager
  - persistence/audit log
  - replay/fingerprint path
  - observability or metrics if implemented
- The diagram must match actual code, not idealized architecture.

Live demo script requirements:
- Add a document that walks a reviewer through the live app:
  1. Open DriftGuard
  2. Go to scenarios
  3. Run sensor drift scenario
  4. Observe DEGRADED behavior
  5. Inject or run controller fault scenario
  6. Observe SAFE_MODE behavior
  7. Inspect decision evidence
  8. Review replay fingerprint or audit output if available
- Include expected observations, not exact values unless deterministic values are guaranteed.
- Add troubleshooting notes for Railway/live deployment if the app is cold-starting or the backend health check is unavailable.

Constraints:
- Do not include screenshots.
- Do not invent unavailable pages.
- Link to existing pages only if routes exist.
- If the current app lacks a step, document the gap and add a TODO.

Deliverable:
- File paths created.
- Short explanation of how the diagram and demo script support portfolio review.

---

# Required phase plan

## Phase 0: Baseline inspection

Before editing:
1. Print repo tree summary.
2. Identify frontend, backend, docs, tests, and CI locations.
3. Run available tests, lint, and type checks.
4. Capture current failures without fixing them yet.
5. Identify live app route structure if route files exist.

Output:
- Baseline status
- Known failures
- Agent work plan with exact file boundaries

Do not edit during Phase 0.

---

## Phase 1: Non-overlapping parallel work

Run Agents A through E with the scopes above.

Rules:
- Agents may inspect the whole repo.
- Agents may only edit files in their assigned scope.
- If two agents need the same file, pause and coordinate ownership.
- Shared files such as README or ARCHITECTURE.md must have one owner at a time.
- Prefer separate commits or grouped diffs per agent if Git is available.

---

## Phase 2: Integration pass

After agents complete:
1. Review all changed files together.
2. Resolve naming inconsistencies.
3. Ensure docs match actual code.
4. Ensure frontend fields match backend schema.
5. Ensure no duplicate sections were created.
6. Ensure no broken links were introduced.
7. Ensure no stale SentinelNav wording remains in user-facing surfaces.

Run searches again:
- SentinelNav
- sentinelnav
- Sentinel Nav
- TODO
- FIXME
- placeholder
- screenshot
- fake
- mock
- lorem
- hardcoded

Do not remove valid TODOs blindly. Classify them.

---

## Phase 3: Verification

Run the strongest available verification commands:
- backend tests
- frontend tests
- type checks
- lint
- coverage if available
- formatting checks
- security scan if configured
- CI-equivalent local command if documented

If a command fails:
- Diagnose the cause.
- Fix if within scope.
- If not within scope, document it clearly.

Do not claim success unless commands actually pass.

---

## Phase 4: Final principal-level report

Produce a final report with:

1. Executive summary
2. Files changed by category
3. Branding cleanup summary
4. Dashboard/operator-console improvements
5. Backend causality fields added or confirmed
6. Production-boundary documentation added
7. Claims audit summary
8. Architecture diagram location
9. Live demo script location
10. Tests/checks run and results
11. Remaining risks
12. Recommended next phase

Use concise technical language.

---

# Quality bar

The final result should make DriftGuard look like a serious portfolio-grade engineering system.

The repo should communicate:
- what the system does
- why the architecture matters
- how decisions are made
- how faults change system behavior
- where the production boundaries are
- what is verified by tests
- what is intentionally demo scope

Do not optimize for cosmetic changes. Optimize for credibility, consistency, explainability, and defensible engineering claims.
