# Tasks

> Task decomposition and progress tracking for Daily Routine.

## Purpose

This document tracks granular implementation tasks, their status, and links to relevant decisions or requirements.

## Status Legend

- `[ ]` — To Do
- `[~]` — In Progress
- `[x]` — Done
- `[!]` — Blocked

## Phase 0 — Project Setup

- [x] Initialize project structure
- [x] Define product requirements (PRD)
- [x] Conduct PRD review and finalize requirements
- [x] Record product decisions in DECISIONS.md
- [x] Finalize technology stack
- [x] Define high-level architecture (System Design)
- [x] Record architectural decisions in DECISIONS.md
- [x] Fill in ARCHITECTURE.md
- [x] Project setup (electron-vite scaffold, toolchain, directory structure)
- [x] Data modeling (ScheduleBlock, AppState, pause state, notification log)
- [x] IPC contracts
- [ ] Fill in ROADMAP.md

## Phase 1 — Schedule & Storage

- [x] TypeScript models for schedule blocks, permanent schedule, daily override, pause state, and notification log
- [x] Default schedule (13 agreed blocks, 10:00–21:00)
- [x] AppStateRepository on electron-store with an in-memory cache
- [x] Read and update the permanent schedule
- [x] Create, update, reset, and expire a daily override
- [x] Resolve the effective schedule (daily override has priority for the current local date)
- [x] Schedule validation: gaps, overlaps, invalid intervals, empty names
- [x] Persist and restore application state across restarts
- [x] Unit tests for domain logic and AppStateRepository

## Phase 2 — Scheduler & Notifications

- [x] Current and next block from the local clock
- [x] Phases: Before Start, Active, After End, Weekend
- [x] Scheduler polling every 1 second, with reconcile on startup, wake, clock jump, and schedule change
- [x] NotificationService via Electron `Notification` (`silent: false`, default timeout)
- [x] Day start, 2-minute warning, next block, end-of-day warning, end of day
- [x] Dedup key `(date, blockId, type)` persisted before send (at-most-once); entries older than yesterday are dropped
- [x] Pause until the next working day, including automatic resume
- [x] Missed notifications are not replayed
- [x] AppStateRepository, Scheduler, NotificationService, and PowerMonitorAdapter wired in `src/main/index.ts`
- [x] Manual toast check: button «Проверить уведомление» — removed in Phase 5; it was a debug control and is not in the PRD
- [x] Unit tests for domain planning, scheduler, repository retention, and notification dispatch

## Phase 3 — User Interface & IPC

- [x] Typed IPC contracts and preload API for state, schedule edits, pause, and quit
- [x] Main process publishes `ScheduleViewState` on each scheduler tick and after mutations
- [x] Main window: current block, countdown, progress, next block, full day, off-schedule states
- [x] Pause / resume and quit
- [x] Schedule editor: add, edit, delete, permanent schedule, daily override, reset, validation errors
- [x] At-most-once dedup: persist the notification key before attempting delivery

## Phase 4 — Desktop Integration

- [x] System tray icon, tooltip, and context menu
- [x] Lazy main window; × hides it and leaves the scheduler running
- [x] Windows autostart, on by default, toggled from the tray
- [x] Single-instance lock; a second launch focuses the existing app
- [x] Quit from the tray or the window stops the scheduler and removes the tray icon
- [x] Sleep/resume still reconciles from the current time and does not replay missed notifications
- [x] App icon for the tray, the window, and the Windows installer

## Phase 5 — Testing & Build

- [x] Compare the implementation with PRD.md and fix the pause control label (`Пауза до следующего дня`)
- [x] Remove the debug toast button, its IPC channel, and the placeholder `ScheduleEditor` test
- [x] Production electron-builder config: NSIS x64, `appId` `com.dailyroutine.app`, version `0.1.0`, icons, source excluded from the package
- [x] `npm run typecheck`, `npm test`, and `npm run build` pass. `npm run lint` reports 0 errors and pre-existing CRLF warnings caused by `core.autocrlf=true` (the git index is LF)
- [x] Windows x64 NSIS installer: `dist/daily-routine-0.1.0-setup.exe`
- [x] Packaged `daily-routine.exe` starts without Node.js and writes `app-state.json` under `%APPDATA%\daily-routine`, not next to the executable
- [ ] Install through the NSIS wizard and confirm the Start menu shortcut, desktop shortcut, and uninstall entry
- [ ] Confirm Windows toast text and the default notification sound for a warning and a transition
- [ ] Confirm sleep/resume and a clock change do not replay missed notifications
- [ ] Confirm autostart after a Windows sign-out uses the installed executable
- [ ] Confirm how Windows SmartScreen treats the unsigned installer

F-25 (one-time warning when Windows notifications are suppressed) is not implemented. OQ-01 is still open: Windows does not expose a reliable signal for Focus Assist or per-app notification settings.

---

_ROADMAP.md is still a stub. That Phase 0 item stays open._
