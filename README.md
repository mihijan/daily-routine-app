# Daily Routine

A personal Windows desktop application for managing a daily study schedule and automated notifications.

## Status

The schedule, notifications, main window, and system tray are implemented. A Windows x64 NSIS installer is produced by `npm run build:win`. Toast delivery, autostart after sign-in, and sleep/resume still need a manual check on Windows. The installer is not code-signed.

## Requirements

Development:

- [Node.js](https://nodejs.org/) 22+ (via [nvm](https://github.com/nvm-sh/nvm) recommended)
- Windows 10/11

The installed application does not need Node.js, npm, Cursor, or this repository. It ships its own Electron runtime.

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

`npm run build:win` writes `dist/daily-routine-0.1.0-setup.exe`.

## Install

1. Run `dist/daily-routine-0.1.0-setup.exe`.
2. The installer is one-click and per-user. It does not ask for an administrator password.
3. The program files are copied to `%LOCALAPPDATA%\Programs\daily-routine\`. The shortcut name is **Daily Routine**. A desktop shortcut is created.
4. The application starts in the system tray. Click the tray icon to open the schedule. Closing the window with × hides it. Quit from the window (**Выход**) or the tray menu.
5. Autostart with Windows is on by default. The tray menu item **Автозапуск с Windows** turns it off.
6. Uninstall from Windows Settings → Apps → **Daily Routine**. Uninstall does not delete the data file below.

Windows SmartScreen can block the first launch because the installer is unsigned. That check was not completed as part of the build.

## User data

Schedule, pause, daily override, notification deduplication, and the autostart preference are stored in:

`%APPDATA%\daily-routine\app-state.json`

On a typical Windows profile that is `C:\Users\<user>\AppData\Roaming\daily-routine\app-state.json`.

This path is Electron's `userData` directory. It is not the installation directory. `electron-store` is created without a custom `cwd`, so it uses that directory. `npm run dev` uses the same file, because the folder name comes from the `name` field in `package.json` (`daily-routine`), not from the display name.

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
