# Decision Log

> Record of technical and architectural decisions for Daily Routine.

## Purpose

This document captures significant decisions, their context, considered alternatives, and rationale.
Keeping this log prevents revisiting settled questions and provides historical context.

## Template

```
### [YYYY-MM-DD] Title

**Status:** Proposed | Accepted | Deprecated | Superseded by [link]

**Context:**
What problem or question prompted this decision?

**Decision:**
What was decided?

**Alternatives considered:**
What other options were evaluated?

**Rationale:**
Why was this option chosen over the alternatives?

**Consequences:**
What are the trade-offs and implications?
```

---

### [2026-11-25] Pause notifications scope

**Status:** Accepted

**Context:**
During requirements review, F-12 ("Pause notifications for today") was found to have a naming contradiction: the label implied full-day silence, but the originally chosen behavior was auto-resume at the next block.
Two variants were considered.

**Decision:**
Pause silences all notifications until the start of the next working day. Manual resume is available. Pause state persists across application restarts.

**Alternatives considered:**
- **Variant A:** Pause until the next block begins, then auto-resume (more granular, but the label "for today" is misleading).
- **Variant B:** Pause until the next working day, with manual resume — chosen.

**Rationale:**
When a user intentionally pauses, they likely need an extended break from interruptions. Auto-resuming at the next block defeats the purpose of pausing. Full-day pause with an explicit resume control is simpler and more predictable.

**Consequences:**
Requires persisting pause state to local storage with an associated date. Requires "next working day" calculation (weekday logic).

---

### [2026-11-25] Schedule changes take effect immediately

**Status:** Accepted

**Context:**
When the user edits the permanent schedule or a daily override mid-day, the timing of when changes apply needed to be defined.

**Decision:**
Both permanent schedule and daily override changes take effect immediately upon saving. Future notification timers are recalculated. Already-fired notifications are not replayed. Daily override takes priority over permanent schedule.

**Alternatives considered:**
- Permanent schedule changes take effect the next day; daily override takes effect immediately.
- Both take effect immediately — chosen.

**Rationale:**
For a personal single-user app, immediate feedback is more intuitive. A user editing a schedule at 14:00 expects to see the effect now. Differentiating "permanent takes effect tomorrow" from "override takes effect now" would be unintuitive and error-prone.

**Consequences:**
The scheduler must be able to cancel pending notification timers and reschedule them on every schedule save. Care must be taken not to replay notifications for blocks that have already passed.

---

### [2026-11-25] Default schedule pre-loaded on first launch

**Status:** Accepted

**Context:**
On first launch, there is no schedule data. The application cannot operate without one. Two approaches were considered.

**Decision:**
The application ships with a pre-configured default schedule based on the user's standard study day (as provided during requirements). On first launch, the user sees the ready schedule and may edit it. If the schedule file is missing or corrupted, the editor opens automatically.

**Alternatives considered:**
- Empty state with a prompt to create a schedule from scratch.
- Pre-loaded default schedule — chosen.

**Rationale:**
Since this is a personal app built for a specific user with a known schedule, pre-loading it eliminates unnecessary setup friction and allows immediate use out of the box.

**Consequences:**
The default schedule must be bundled with the application (hardcoded or as a data file). The schedule storage format must be defined before implementation.

---

### [2026-11-25] Technology stack selection

**Status:** Accepted

**Context:**
Three technology stacks were evaluated for the Daily Routine desktop application:
Electron + React + TypeScript, Tauri + React + TypeScript + Rust, and .NET + C# + WPF.

**Decision:**
Electron + React + TypeScript with the following toolchain:
- **electron-vite** — build tooling (Vite-based, fast HMR)
- **electron-store** — local persistence for schedule and app state
- **electron-builder** — packaging and Windows installer
- **Tailwind CSS** — utility-first styling
- **Vitest** — unit testing
- **ESLint + Prettier** — code quality and formatting

Additional dependencies are added only with justification.

**Alternatives considered:**
- Tauri + React + TypeScript + Rust — lower RAM footprint, but Rust backend required for all OS integration (scheduler, sleep events, notifications). Developer has no Rust experience; risk to development velocity was deemed unacceptable for a personal tool.
- .NET + C# + WPF — best native Windows integration (time change events, notification status detection), but developer has no C# or WPF experience. XAML-based schedule editor significantly more complex than React equivalent.

**Rationale:**
Developer's existing React and TypeScript expertise eliminates a major risk factor. For a personal single-user tool, the RAM overhead of Electron (~80–150 MB estimated, unverified) is acceptable on a modern workstation. Node.js in the main process allows applying familiar patterns from NestJS. Cursor Agent is most effective with TypeScript.

**Consequences:**
- RAM consumption must be measured after initial implementation; lazy BrowserWindow creation should be used to minimize background footprint.
- System time change detection has no native Electron event — requires a workaround (polling actual system time is the preferred approach; native addon is explicitly avoided unless proven necessary).
- OQ-01 (detecting disabled Windows notifications) is non-blocking and deferred to System Design / PoC.
- The following PoC tasks are required before or during early implementation: toast notification behavior and sound, sleep/resume recovery, system time change handling via polling, tray functionality, autostart registration, and background resource measurement.

---

### [2026-11-25] High-level application architecture

**Status:** Accepted

**Context:**
Following technology stack selection, a high-level architecture was proposed and reviewed. Several structural decisions were made during the review.

**Decision:**
See `ARCHITECTURE.md` for the full architecture. Key architectural decisions are recorded individually below.

---

### [2026-11-25] Polling at 1-second interval with in-memory state

**Status:** Accepted

**Context:**
The scheduler needs to check whether any notifications are due. Two approaches were considered: setInterval-based timers (fire once at a specific time) or polling (check actual system time on every tick).

**Decision:**
Polling at 1-second intervals using actual system time. All state required by the tick (schedule, pause, deduplication log) must be held in memory — no disk I/O per tick. AppStateRepository maintains an in-memory cache; electron-store is written on mutation, read on startup only.

**Alternatives considered:**
- Long-lived `setTimeout` timers scheduled for exact notification times. Fragile under sleep/resume and system time changes; each change to the schedule requires cancelling and rescheduling timers.
- Polling at 15–30 seconds. Lower precision; not suitable for 1-second accuracy requirements.

**Rationale:**
Polling against actual system time is resilient to sleep/resume and time changes without special-casing. At 1-second intervals, CPU overhead is negligible. In-memory state eliminates disk I/O on every tick. Combined with deduplication by composite key, polling is both correct and simple.

**Consequences:**
AppStateRepository must expose a synchronous in-memory read (`getInMemoryState()`). The in-memory cache must be kept consistent with electron-store on every write. Tick must be protected against re-entry.

---

### [2026-11-25] Separation of polling tick and reconciliation

**Status:** Accepted

**Context:**
Two distinct scheduler operations were identified: the regular 1-second tick (check if notification is due now) and state reconciliation (recalculate reference point after external events).

**Decision:**
- **Tick**: runs every second; checks in-memory state against current time; fires notifications if due and not deduplicated; protected against re-entry with an `isTickRunning` guard.
- **Reconcile**: triggered on startup, sleep/resume, schedule save, pause state change; updates the scheduler's reference point; pushes computed state to TrayManager and open Renderer; does NOT replay missed notifications.

**Alternatives considered:**
- Treating all scheduler activity as a single operation. Makes re-entry protection harder and conflates two distinct concerns.

**Rationale:**
Separating tick from reconcile makes each operation simpler and independently testable. Reconcile is the correct place to handle "recalculate from now" semantics without side effects on the notification log.

**Consequences:**
Scheduler exposes both `tick()` (internal, called by interval) and `reconcile()` (called by external triggers). Bootstrap wires reconcile to: PowerMonitorAdapter, IPC save handlers, pause state changes.

---

### [2026-11-25] Bootstrap as composition root — callback wiring, no event bus

**Status:** Accepted

**Context:**
Components need to communicate: Scheduler must update TrayManager and Renderer when state changes; PowerMonitorAdapter must trigger reconcile; IPC handlers must trigger reconcile after mutations.

**Decision:**
The main process entry point (`src/main/index.ts`) acts as the composition root. It creates all components and wires them together by passing typed callbacks at construction time. No application-level event bus is introduced.

**Alternatives considered:**
- Node.js `EventEmitter` as a lightweight event bus. Adds indirection, makes dependencies implicit, and is unnecessary for a small number of components.
- Direct cross-dependencies between modules (e.g., Scheduler imports TrayManager). Creates coupling and circular dependency risk.

**Rationale:**
Callback-based composition is explicit, typesafe, and easy to follow. All wiring is in one place (index.ts). Each component remains independently testable by injecting mock callbacks.

**Consequences:**
Bootstrap (index.ts) is the only place with knowledge of all components. Each component depends only on its own callback interfaces, not on concrete implementations of other components.

---

### [2026-11-25] Domain layer isolation

**Status:** Accepted

**Context:**
Core business logic (block lookup, notification timing, schedule validation, deduplication key generation) should be unit-testable without Electron.

**Decision:**
All pure TypeScript business logic is placed in `src/domain/`. This directory has zero runtime dependencies on Electron, Node.js, or electron-store. It exports pure functions and contains no side effects. It is consumed by Main process modules only; Renderer receives computed state via IPC.

**Alternatives considered:**
- Business logic scattered across Scheduler, AppStateRepository, and IPC handlers.
- Domain logic in `src/shared/` alongside types.

**Rationale:**
Isolating domain logic enables Vitest tests with no Electron mocking. It also prevents accidental coupling of business logic to platform details.

**Consequences:**
Domain types that are shared with Renderer (e.g., ScheduleBlock) live in `src/shared/types.ts`. Domain functions that operate on those types live in `src/domain/`. Domain functions must not import from `src/main/`, `src/preload/`, or `src/renderer/`.

---

### [2026-11-25] No popup fallback for toast notifications

**Status:** Accepted

**Context:**
Windows toast notifications can be suppressed by OS-level settings (Do Not Disturb, Focus Assist, per-app restrictions). The question arose whether to implement an alternative delivery mechanism.

**Decision:**
No popup fallback in MVP. If notifications appear to be suppressed, the application shows a one-time warning in the main window at startup. The application does not override OS notification restrictions.

**Alternatives considered:**
- Always-on-top popup window as a fallback delivery mechanism.
- No fallback; documented as a known limitation — chosen.

**Rationale:**
An always-on-top popup window would be invasive and conflict with the goal of unobtrusive background operation. Standard system notifications are sufficient for personal use. The limitation is documented in F-25.

**Consequences:**
Notification delivery is not guaranteed when OS-level settings restrict it. Responsibility for ensuring notifications are enabled lies with the user. Whether the application can reliably detect disabled notifications at runtime is deferred to System Design (OQ-01).
