# DriftGuard Phase 2: Operator Experience and Explainability Upgrade

You are continuing work on DriftGuard after completion of Phase 1 hardening.

Phase 1 already addressed:
- branding consistency
- causality field exposure
- architecture/documentation cleanup
- production-boundary clarification
- baseline frontend improvements
- claim verification
- operator-console foundation work

This Phase 2 prompt is NOT a cleanup pass.

This is a focused product-interpretation and operator-experience upgrade.

The goal is to transform DriftGuard from:
- a technically impressive engineering dashboard

into:
- an interactive explainable systems simulation platform.

The UI/UX is now the highest-priority surface in the entire project.

---

# Strategic objective

A reviewer should be able to open DriftGuard and immediately understand:

1. What DriftGuard is
2. What system is being simulated
3. What fault occurred
4. What evidence was detected
5. Which controllers agreed or disagreed
6. Why the system changed modes
7. What action the system took
8. Why deterministic replay matters
9. Why this project demonstrates principal-level engineering thinking

The app itself must communicate this.

The reviewer should NOT need to:
- read architecture docs first
- inspect backend code
- infer system behavior manually
- mentally connect unrelated panels

The interface must become:
- guided
- causal
- explainable
- operational
- technically credible

NOT:
- flashy
- marketing-heavy
- decorative
- overly animated
- generic SaaS styling

---

# Critical mindset

DriftGuard is NOT a CRUD app.

It is:
- a deterministic safety simulation platform
- a fault-analysis system
- a replayable decision engine
- an explainable systems-thinking portfolio artifact

The frontend must explain:
- escalation
- trust degradation
- fault detection
- majority voting
- replayability
- operator reasoning
- final system behavior

The app should feel like:
- a lightweight operational command interface
- an engineering investigation tool
- a safety-review console

NOT:
- a startup analytics dashboard
- a template admin panel
- a generic monitoring UI

---

# Existing sources to inspect

Use these as primary interpretation sources:
- docs/PORTFOLIO_CASE_STUDY.md
- architecture docs
- scenario docs
- ADRs
- backend schemas
- replay docs
- detector docs
- safe-mode docs
- event model docs

Extract the best ideas from these documents and surface them naturally inside the UI.

Do not copy long paragraphs into the frontend.

Compress concepts into:
- operator explanations
- evidence summaries
- contextual callouts
- guided interpretation panels

---

# Parallel agent structure

Run multiple agents in parallel.

Agents MUST NOT overlap ownership.

If a shared file is needed:
- establish ownership
- complete work sequentially
- avoid merge conflicts

---

# Agent A: Landing experience and onboarding flow

Scope:
Own the landing page and first-run user experience.

Goal:
A reviewer should understand DriftGuard within 30 seconds.

Required upgrades:

## 1. Landing-page restructuring

The landing page must clearly answer:
- What is DriftGuard?
- What problem does it simulate?
- Why does redundant control matter?
- Why do safe modes matter?
- Why does deterministic replay matter?

Avoid:
- buzzwords
- startup language
- generic AI claims
- empty hero sections

Prefer:
- technical clarity
- concise system framing
- operational language

---

## 2. Guided demo entrypoint

Add a highly visible:
- "Start Guided Demo"
or
- "Run First Scenario"

The user should not wonder where to begin.

---

## 3. Demo preview cards

Add short scenario preview cards showing:
- scenario name
- injected fault
- expected system behavior
- expected escalation level
- what the reviewer should observe

Examples:
- Sensor Drift
- Controller Disagreement
- Safe Mode Escalation
- Critical Fault Isolation

---

## 4. Embedded portfolio framing

Add concise in-app callouts:
- "Demonstrates deterministic replay"
- "Demonstrates explainable fault escalation"
- "Demonstrates redundant controller voting"

These should be subtle and technical.

Not marketing blurbs.

---

Deliverables:
- improved landing experience
- guided first-run flow
- clearer onboarding
- scenario entry improvements

---

# Agent B: Decision explainability system

Scope:
Own all decision interpretation surfaces.

Goal:
Every important system decision must explain itself.

Required upgrades:

## 1. Unified decision explanation panel

Create or improve a reusable panel showing:
- previous mode
- current mode
- transition reason
- detector finding
- active faults
- trust degradation
- vote outcome
- final action
- replay fingerprint

This component should become a core UI primitive.

---

## 2. Event-to-decision pipeline visualization

Create a visual chain like:

Sensor Drift
↓
Detector Triggered
↓
Controller Disagreement Increased
↓
Trust Reduced
↓
Mode Escalated to DEGRADED
↓
Safe Action Applied

This is one of the highest-value additions.

Keep it:
- readable
- operational
- deterministic
- minimal

---

## 3. Fault evidence interpretation

Transform raw fault output into operator-readable evidence.

Show:
- what triggered detection
- what threshold/rule was crossed
- which component was affected
- what action was taken

Avoid raw JSON dumps unless expandable.

---

## 4. Replay explainability

Replay fingerprints are a strong engineering signal.

Explain:
- what replayability means
- why deterministic replay matters
- how it supports auditability and verification

Do this inside the UI where replay data appears.

---

Deliverables:
- reusable explanation components
- causal pipeline views
- replay interpretation surfaces
- operator-readable evidence system

---

# Agent C: Controller voting and trust visualization

Scope:
Own controller visualization and trust-state interpretation.

Goal:
A reviewer should understand majority voting in under 5 seconds.

Required upgrades:

## 1. Controller vote visualization

Show:
- Controller A recommendation
- Controller B recommendation
- Controller C recommendation
- majority outcome
- excluded/invalid controller if applicable

Use:
- compact comparison cards
- vote status indicators
- trust indicators

Avoid:
- clutter
- giant tables
- unnecessary charts

---

## 2. Trust degradation visibility

Add explicit trust-state interpretation:
- stable
- warning
- degraded
- critical disagreement

Trust state should evolve visibly during escalation.

---

## 3. Confidence and reliability communication

If backend data supports it:
- expose confidence
- expose trust score
- expose detector severity

If unavailable:
- gracefully fallback
- document missing backend support

---

## 4. Voting rationale summaries

Add short summaries like:
- "Majority consensus maintained."
- "Controller disagreement exceeded tolerance."
- "Controller C excluded due to invalid output."

Keep these concise and operational.

---

Deliverables:
- voting visualization system
- trust-state interpretation
- disagreement communication
- reliability indicators

---

# Agent D: Scenario storytelling and operator cognition

Scope:
Own scenario interpretation and flow comprehension.

Goal:
Reduce reviewer cognitive load.

The system should assemble the story automatically.

Required upgrades:

## 1. Scenario narrative structure

Each scenario page should explain:
- scenario purpose
- injected condition
- expected behavior
- escalation expectation
- what to inspect after execution

---

## 2. Mode transition timeline

Create a mode progression timeline:
- NORMAL
- DEGRADED
- SAFE_MODE
- FAILED

Highlight:
- current state
- transition cause
- transition timestamp if available

---

## 3. Execution summary cards

After scenario execution:
summarize:
- fault introduced
- detector response
- controller agreement state
- escalation result
- final system action

This should feel like:
- incident review
- operational debrief
- post-event summary

---

## 4. Operator cognition optimization

The reviewer should NOT need to manually correlate:
- faults
- votes
- detector state
- mode
- action

The UI should correlate these automatically.

---

Deliverables:
- scenario interpretation improvements
- mode timelines
- execution summaries
- lower cognitive overhead

---

# Agent E: Interaction polish and operational UX

Scope:
Own operational usability and interaction quality.

Goal:
Make the application feel coherent and intentional.

Required upgrades:

## 1. Empty states

Replace generic empty states with:
- explanation
- next action
- operational guidance

---

## 2. Loading states

Loading should feel:
- stable
- technical
- operational

Avoid:
- generic skeleton overload
- flashy loaders

---

## 3. Error states

Error messaging should:
- explain probable cause
- suggest next action
- distinguish backend outage vs no data vs invalid scenario

---

## 4. Navigation clarity

Improve:
- route discoverability
- page hierarchy
- scenario navigation
- return paths

The reviewer should never feel trapped.

---

## 5. Mobile operational usability

Preserve readability on mobile:
- stacked cards
- readable timelines
- compact evidence panels
- usable voting views

---

Deliverables:
- improved UX coherence
- operational-state polish
- mobile usability preservation
- navigation improvements

---

# Integration phase

After all agents complete:

1. Review all UI surfaces together
2. Ensure terminology consistency
3. Ensure no duplicated explanation systems exist
4. Ensure explanations remain concise
5. Ensure all backend fields map correctly
6. Ensure no fake data was introduced
7. Ensure accessibility/readability remain acceptable
8. Ensure mobile responsiveness remains functional

Search again for:
- placeholder
- TODO
- FIXME
- mock
- fake
- lorem
- temporary

Classify rather than blindly removing.

---

# Verification phase

Run:
- frontend tests
- backend tests affected by UI contracts
- type checks
- lint
- formatting
- build verification

Verify:
- no broken routes
- no hydration errors
- no missing field crashes
- no undefined causality chains

Do not claim completion unless verification succeeds.

---

# Final report requirements

Produce:
1. Executive summary
2. Major UX improvements
3. New reusable components
4. New operator explanation systems
5. New visualization systems
6. Scenario storytelling improvements
7. Replay explainability improvements
8. Voting/trust visualization improvements
9. Mobile usability notes
10. Remaining UX gaps
11. Recommended Phase 3 improvements

Keep the tone technical and concise.

---

# Quality bar

The final result should make DriftGuard feel like:
- a safety-system simulation platform
- an explainable engineering system
- a replayable operational console
- a principal-level systems-thinking portfolio project

The UI must expose the sophistication already present in the backend and documentation.
