# Daily Routine

A personal Windows desktop application for managing daily schedules and automated notifications.

## Status

🚧 Active development — project scaffolding complete.

## Requirements

- [Node.js](https://nodejs.org/) 22+ (via [nvm](https://github.com/nvm-sh/nvm) recommended)
- Windows 10/11 (target platform for running the app)

## Getting Started

```bash
npm install
npm run dev        # start in development mode
```

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
│   ├── power/
│   ├── scheduler/
│   ├── store/
│   ├── tray/
│   └── window/
├── preload/       # contextBridge security layer
├── renderer/      # React application (Chromium)
│   ├── components/
│   └── hooks/
└── shared/        # Types and IPC contracts (used by both Main and Renderer)

tests/
├── domain/        # Unit tests for pure domain logic
└── renderer/      # Component tests (requires happy-dom when implemented)
```

## Documentation

- [Product Requirements](docs/PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Tasks](docs/TASKS.md)
- [Decision Log](docs/DECISIONS.md)
