# Architecture

> System architecture for Daily Routine — a personal Windows desktop application for managing daily schedules and automated notifications.

---

## 1. Overview

Daily Routine is an Electron desktop application. It runs silently in the Windows system tray, fires toast notifications at scheduled times, and provides a GUI for viewing and editing the schedule.

**Technology stack:** Electron · React · TypeScript · electron-vite · electron-store · electron-builder · Tailwind CSS · Vitest · ESLint · Prettier

---

## 2. Process Model

Electron applications consist of three execution contexts:

```
┌─────────────────────────────────────────────────────────────────┐
│  MAIN PROCESS (Node.js)                                          │
│                                                                  │
│  Single privileged process. Owns all OS integration,            │
│  business logic, scheduling, and local persistence.             │
│  Runs for the entire application lifetime.                       │
└──────────────────────────────┬──────────────────────────────────┘
                               │ contextBridge (window.api)
┌──────────────────────────────▼──────────────────────────────────┐
│  PRELOAD SCRIPT                                                  │
│                                                                  │
│  Security boundary. Exposes a minimal, typed API to Renderer    │
│  via contextBridge. Contains no business logic.                 │
└──────────────────────────────┬──────────────────────────────────┘
                               │ window.api.*
┌──────────────────────────────▼──────────────────────────────────┐
│  RENDERER PROCESS (Chromium + React)                             │
│                                                                  │
│  Sandboxed. Renders UI only. No direct access to Node.js,       │
│  Electron APIs, or the filesystem. Communicates exclusively     │
│  via window.api (contextBridge).                                │
└─────────────────────────────────────────────────────────────────┘
```

**Responsibility split:**

| Concern | Process |
|---|---|
| OS notifications, tray, autostart | Main |
| Schedule persistence (electron-store) | Main |
| Scheduling logic, deduplication | Main |
| powerMonitor, sleep/resume | Main |
| IPC handler registration | Main |
| Security bridge (contextBridge) | Preload |
| Schedule display, block editor | Renderer |
| User interaction | Renderer |

**Main Process is the single source of truth.** Renderer and TrayManager receive computed state; they do not duplicate business logic.

---

## 3. Source Structure

```
src/
├── domain/                          # Pure TypeScript — no Electron, no side effects
│   ├── schedule.ts                  # Block lookup, notification timing, effective schedule
│   ├── validation.ts                # Gap-free and overlap checks
│   └── time.ts                      # Weekday detection, off-schedule state, dedup keys
│
├── main/                            # Main process (Node.js + Electron)
│   ├── index.ts                     # Bootstrap / composition root
│   ├── ipc/
│   │   └── handlers.ts              # ipcMain.handle registration, input validation
│   ├── scheduler/
│   │   └── Scheduler.ts             # Polling loop (tick) + reconciliation
│   ├── store/
│   │   └── AppStateRepository.ts    # electron-store + in-memory cache
│   ├── notifications/
│   │   └── NotificationService.ts   # Windows toast dispatch (platform only)
│   ├── tray/
│   │   └── TrayManager.ts           # Tray icon, tooltip, context menu
│   ├── window/
│   │   └── WindowManager.ts         # BrowserWindow lazy lifecycle + isQuitting
│   └── power/
│       └── PowerMonitorAdapter.ts   # powerMonitor.on('resume') wrapper
│
├── preload/
│   └── index.ts                     # contextBridge.exposeInMainWorld('api', {...})
│
├── renderer/
│   ├── main.tsx                     # React entry point
│   ├── App.tsx
│   ├── components/
│   │   ├── ScheduleView.tsx         # Daily schedule display
│   │   └── ScheduleEditor.tsx       # Block editing form
│   └── hooks/
│       └── useScheduleApi.ts        # Typed wrapper over window.api
│
└── shared/
    ├── types.ts                     # Interfaces used by both Main and Renderer
    └── ipc-contracts.ts             # IPC channel names + typed request/response shapes

tests/
├── domain/                          # Unit tests for pure domain logic
└── main/                            # Unit tests for storage, scheduler, IPC, and notifications
```

**Layer constraints:**

| Layer | May import from |
|---|---|
| `src/domain/` | Nothing outside `src/shared/types.ts` |
| `src/main/` | `src/domain/`, `src/shared/` |
| `src/preload/` | `src/shared/ipc-contracts.ts` only |
| `src/renderer/` | `src/shared/types.ts`, `src/shared/ipc-contracts.ts` |
| `src/shared/` | Nothing (types and constants only) |

---

## 4. Functional Modules

### 4.1 AppStateRepository (`src/main/store/`)

Owns all persistent state. Wraps a single `electron-store` instance with five logical keys:

| Key | Contents |
|---|---|
| `schemaVersion` | Integer, for future migrations |
| `permanentSchedule` | Array of time blocks (the base schedule) |
| `dailyOverride` | Override blocks for a specific date, or null |
| `pauseState` | Whether notifications are paused and until when |
| `notificationLog` | Record of fired notifications for deduplication |

**Key behavior:**
- Loads all state from disk into memory on `init()`.
- All subsequent reads are from the in-memory cache (no disk I/O per tick).
- Every write updates the in-memory cache and persists to disk atomically.
- Exposes `getInMemoryState()` for synchronous reads by Scheduler and IPC handlers.
- Exposes `getEffectiveSchedule()`: merges permanentSchedule and dailyOverride (domain logic).

### 4.2 Scheduler (`src/main/scheduler/`)

The central component. Responsible for notification dispatch decisions.

**Two distinct operations:**

**`tick()`** — runs every 1 second:
- Protected by `isTickRunning` guard against re-entry.
- Reads in-memory state via `getState()` callback.
- Calls domain logic to determine if any notification is due at the current second.
- Checks deduplication: skips if notification key already fired.
- If a notification should fire: calls `sendNotification()` callback.

**`reconcile()`** — triggered by external events:
- Called on: startup, sleep/resume, schedule save, pause state change.
- Recalculates the scheduler's reference point to current system time.
- Missed notifications (past due) are **not** replayed.
- Calls `onStateChange()` callback — pushes computed state to TrayManager and open Renderer.

**Triggered by:**
- Bootstrap on `app.ready` (initial reconcile)
- `PowerMonitorAdapter` on resume from sleep
- IPC handlers after any state mutation (schedule save, pause toggle)

### 4.3 NotificationService (`src/main/notifications/`)

Single responsibility: platform-level dispatch of Windows toast notifications. Contains no scheduling, deduplication, or pause logic — those live in Scheduler.

### 4.4 TrayManager (`src/main/tray/`)

Creates and manages the system tray icon. Receives computed state via callback from Scheduler's `onStateChange`. Updates the tooltip to reflect the current application state (active block, off-schedule states, pause indicator). Provides a context menu with "Open" and "Quit" actions.

### 4.5 WindowManager (`src/main/window/`)

Manages the main BrowserWindow with a lazy lifecycle:
- Window is created on first open (not at startup).
- `×` close event is intercepted; window is hidden, not destroyed.
- `isQuitting` flag (set in `before-quit`) allows the close handler to skip interception during actual shutdown.
- Exposes `show()` and `hide()` methods.
- Pushes state updates to the open window via `webContents.send(...)`.

### 4.6 PowerMonitorAdapter (`src/main/power/`)

Thin adapter. Subscribes to `powerMonitor.on('resume')` and calls `scheduler.reconcile()`. Contains no logic.

### 4.7 IPC Handlers (`src/main/ipc/`)

Registers all `ipcMain.handle(...)` endpoints. Responsibilities:
- Validates incoming data at runtime before passing to AppStateRepository.
- Verifies IPC message sender (`event.senderFrame`).
- Calls `scheduler.reconcile()` after any mutation.
- Returns computed state from in-memory cache (no disk read on query).

### 4.8 Bootstrap (`src/main/index.ts`)

Composition root. Creates all components, wires them together via typed callbacks, and starts the application. The only module with knowledge of all components.

---

## 5. Dependency Directions

```
Bootstrap (index.ts)  ← composition root, creates and wires all components
│
├── AppStateRepository ←── electron-store (disk)
│         ↑ getInMemoryState()
│
├── NotificationService ←── Electron Notification API
│         ↑ sendNotification()
│
├── Scheduler
│   ├── ← getState callback       (from AppStateRepository via Bootstrap)
│   ├── ← sendNotification cb     (from NotificationService via Bootstrap)
│   └── ← onStateChange cb        → TrayManager.updateState()
│                                  → WindowManager.pushState() (if open)
│
├── TrayManager ←── Electron Tray API
│         ↑ updateState()
│
├── WindowManager ←── Electron BrowserWindow API
│         ↑ show() / hide() / pushState()
│
├── PowerMonitorAdapter ←── Electron powerMonitor
│         → scheduler.reconcile()  (callback)
│
└── IPC Handlers ←── ipcMain
      ├── AppStateRepository (read + write)
      └── scheduler.reconcile()  (callback)

src/domain/  ←── used by Scheduler, AppStateRepository (pure functions)
src/shared/  ←── used by main/, preload/, renderer/ (types + IPC contracts)
```

No circular dependencies. Domain layer has no outbound dependencies.

---

## 6. Component Interaction

```
  [System Clock]  every 1s      [powerMonitor]   schedule/pause change
        │                             │                    │
        ▼                             ▼                    ▼
  ┌──────────────────────────────────────────────────────────────┐
  │                        Scheduler                              │
  │                                                               │
  │  tick():       check time → dedup → sendNotification cb      │
  │  reconcile():  update ref point → onStateChange cb           │
  └──────────────────────────────────────────────────────────────┘
         │ sendNotification             │ onStateChange
         ▼                             ▼
  NotificationService          TrayManager.updateState()
  (Windows Toast)              WindowManager.pushState()
                                      │
                               webContents.send(...)
                                      │
                                      ▼
                                 [Renderer]
                               React App updates UI


  [User clicks tray]     [User saves schedule]    [User clicks Quit]
         │                       │                        │
  WindowManager.show()    IPC → AppStateRepository    IPC → app.quit()
                          IPC → scheduler.reconcile()
```

---

## 7. Application Lifecycle

### Startup
```
app.on('ready')
  1. AppStateRepository.init()         — load all state from disk into memory
  2. TrayManager.init()                — create tray icon
  3. PowerMonitorAdapter.init()        — subscribe to powerMonitor 'resume'
  4. IPC Handlers.register()           — register all ipcMain.handle(...)
  5. app.setLoginItemSettings(...)     — register autostart (idempotent)
  6. Scheduler.start()                 — start 1s setInterval + initial reconcile
  // WindowManager: no window created — lazy initialization
```

### Opening the Window
```
User clicks tray icon (or "Open" in context menu)
  → WindowManager.show()
  → if (window === null): new BrowserWindow() → load renderer URL
  → else: window.show() + window.focus()
  → React mounts → window.api.getState() → IPC → AppStateRepository.getInMemoryState()
  → Renderer displays current schedule and state
```

### Closing the Window
```
User clicks × button
  → window.on('close', event)
  → if (!isQuitting): event.preventDefault(); window.hide()
  → Application continues silently in tray
```

### Quitting
```
User clicks "Выход" in window (or tray context menu)
  → Renderer: window.api.quit()
  → IPC → app.quit()
  → app.on('before-quit'): isQuitting = true; Scheduler.stop()
  → window 'close' fires without preventDefault (isQuitting = true)
  → Process exits
  // Critical state already persisted on each mutation — no flush needed on quit
```

### Scheduler Tick (every 1 second)
```
Scheduler.tick()
  → if (isTickRunning) return          — re-entry guard
  → isTickRunning = true
  → state = getState()                 — in-memory read, no disk I/O
  → notifications = domain.getNotificationsDue(state, now)
  → for each n: if (!state.notificationLog.hasFired(n.key))
      → sendNotification(n)
      → AppStateRepository.markFired(n.key)   — persist dedup entry
  → isTickRunning = false
```

### Reconciliation (triggered externally)
```
Scheduler.reconcile()
  → state = getState()                 — in-memory read
  → referenceTime = now                — set new reference point; past notifications skipped
  → computedState = domain.computeAppState(state, now)
  → onStateChange(computedState)       — push to TrayManager + open Renderer
```

---

## 8. IPC Security

| Measure | Details |
|---|---|
| `contextIsolation: true` | Renderer has no access to Node.js globals (Electron default ≥ v12) |
| `nodeIntegration: false` | Renderer cannot call `require()` (Electron default) |
| `sandbox: true` | Renderer is sandboxed at Chromium level |
| Typed bridge | Renderer uses `window.api.methodName()` — no raw IPC channel names exposed |
| Sender validation | IPC handlers verify `event.senderFrame` origin matches expected renderer URL |
| Runtime input validation | All IPC payloads validated in Main before passing to AppStateRepository |
| Subscription cleanup | Renderer-side `ipcRenderer.on(...)` listeners registered in preload are removed via `removeAllListeners` on window unload to prevent leaks |
| CSP | `Content-Security-Policy` configured on BrowserWindow to block inline scripts and external resources |

---

## 9. Data Persistence

A single `electron-store` instance is used with the following logical keys:

| Key | Type | Persisted on |
|---|---|---|
| `schemaVersion` | `number` | App init (once) |
| `permanentSchedule` | `ScheduleBlock[]` | Save in editor |
| `dailyOverride` | `DailyOverride \| null` | Save/reset in editor |
| `pauseState` | `PauseState` | Pause/resume toggle |
| `notificationLog` | `NotificationLogEntry[]` | Each notification fired |

**Critical state** (pauseState, notificationLog) is persisted **on change**, not on shutdown. This ensures correctness after power loss or crash.

Deduplication log retention policy (what to keep, when to prune) is deferred to the Scheduler Design phase.

---

## 10. Architectural Risks

| # | Risk | Mitigation |
|---|---|---|
| AR-01 | Re-entrant tick if 1s operation takes longer than 1s | `isTickRunning` guard; tick is in-memory and expected to complete in < 1ms |
| AR-02 | IPC race: Renderer requests state before first reconcile completes | Scheduler reconcile runs synchronously in `app.on('ready')` before any window is created |
| AR-03 | notificationLog grows unboundedly | Retention policy deferred to Scheduler Design |
| AR-04 | electron-store schema changes in future versions | `schemaVersion` key enables migrations; policy deferred to implementation |
| AR-05 | OQ-01: detecting disabled Windows notifications | Non-blocking; deferred to Scheduler Design / PoC |
| AR-06 | Tailwind CSS class purging removes dynamically composed class names | Configure `safelist` or use static class names where dynamic composition is needed |
