# Daily Routine

A personal Windows desktop application for managing a daily study schedule and automated notifications.

## Status

Active development. The schedule, notifications, main window, and system tray are implemented. Packaging and Windows toast delivery still need a manual check on Windows.

## Requirements

- [Node.js](https://nodejs.org/) 22+ (via [nvm](https://github.com/nvm-sh/nvm) recommended)
- Windows 10/11 to run the app

Run `npm run dev` from Windows PowerShell or cmd. The Linux Electron build inside WSL has no OpenGL and no session D-Bus, so the window and tray do not start there.

## Getting Started

```bash
npm install
npm run dev
```

The process starts in the system tray and does not open the window by itself. Click the tray icon to open the schedule. Closing the window with × hides it; the scheduler keeps running. Quit from the window or the tray menu.

## Available Commands

| Command             | Description                                      |
|---------------------|--------------------------------------------------|
| `npm run dev`       | Start in development mode (with hot reload)      |
| `npm run build`     | Typecheck + compile + bundle for production      |
| `npm run build:win` | Build + create Windows installer (.exe)          |
| `npm run typecheck` | Run TypeScript checks (node + web)               |
| `npm run lint`      | Run ESLint                                       |
| `npm run format`    | Run Prettier                                     |
| `npm test`          | Run Vitest (single run)                          |
| `npm run test:watch`| Run Vitest in watch mode                         |

## Project Structure

```
src/
├── domain/        # Pure TypeScript business logic (no Electron deps)
├── main/          # Electron Main process (Node.js)
│   ├── ipc/       # IPC handler registration
│   ├── notifications/
│   ├── power/     # sleep/resume → scheduler reconcile
│   ├── scheduler/
│   ├── startup/   # Windows autostart
│   ├── store/
│   ├── tray/
│   └── window/    # lazy window; × hides to tray
├── preload/       # contextBridge security layer
├── renderer/      # React application (Chromium)
│   ├── components/
│   └── hooks/
└── shared/        # Types and IPC contracts (used by both Main and Renderer)

tests/
├── domain/        # Unit tests for schedule rules and notification timing
└── main/          # Unit tests for storage, scheduler, IPC, and notifications
```

`npm test` runs `tests/**/*.test.ts` only.

## Documentation

- [Product Requirements](docs/PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Tasks](docs/TASKS.md)
- [Decision Log](docs/DECISIONS.md)
