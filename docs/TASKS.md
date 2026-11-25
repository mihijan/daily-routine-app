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
- [x] Manual toast check: button «Проверить уведомление»
- [x] Unit tests for domain planning, scheduler, repository retention, and notification dispatch

## Phase 3 — User Interface & IPC

- [x] Typed IPC contracts and preload API for state, schedule edits, pause, and quit
- [x] Main process publishes `ScheduleViewState` on each scheduler tick and after mutations
- [x] Main window: current block, countdown, progress, next block, full day, off-schedule states
- [x] Pause / resume and quit
- [x] Schedule editor: add, edit, delete, permanent schedule, daily override, reset, validation errors
- [x] At-most-once dedup: persist the notification key before attempting delivery

Not in this phase: tray and autostart.

---

_Tasks for subsequent phases will be added as the roadmap is defined._
