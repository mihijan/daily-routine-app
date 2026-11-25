# Product Requirements Document

> Daily Routine — personal desktop application for managing daily schedules and automated notifications.

## 1. Problem Statement

The user has a fixed daily study schedule (Mon–Fri) but finds it inconvenient to manually track when each activity starts or ends.
Constant clock-checking breaks focus and creates unnecessary cognitive overhead.

## 2. Goal

Eliminate the need to track time manually.
The application automatically signals each block transition, allowing the user to stay fully focused on the current activity.

## 3. Target Users

Personal use only. Single user, Windows desktop/laptop (home PC + laptop, independent instances).

---

## 4. Schedule Model

- The schedule is a fixed, continuous sequence of time blocks (no gaps, no overlaps).
- All blocks run from a defined start time to end time and cover the full active day.
- The same schedule applies every working day (Mon–Fri).
- On weekends, the application is silent and does not trigger any notifications.
- Schedule data is stored and edited locally on each machine independently (no sync).
- If a **daily override** exists for the current date, it takes priority over the permanent schedule.

---

## 5. Functional Requirements

### 5.1 Notifications

| # | Requirement |
|---|---|
| F-01 | The application fires a **warning notification** 2 minutes before the end of each block. |
| F-02 | The application fires a **transition notification** at the exact moment each block begins, including the **first block of the day** (start-of-day signal). Notification text: name of the starting block (e.g., *"Слепая печать №1"*). |
| F-03 | Warning notification text: *"→ [Next block name]"*. Exception for the **last block** of the day: *"Учебный день заканчивается через 2 минуты"*. |
| F-04 | Notifications are delivered as **Windows toast notifications** accompanied by the **standard Windows system sound**. The same sound is used for both warning and transition notifications. |
| F-05 | No user interaction is required; notifications dismiss automatically. |
| F-06 | At the end of the last block, the application fires a final notification in place of a transition: *"Учебный день завершён! Время отдыхать"*. |

### 5.2 Application Presence

| # | Requirement |
|---|---|
| F-07 | The application runs as a **system tray icon** and does not occupy taskbar space. |
| F-08 | The application **auto-starts** with Windows on login. |
| F-09 | The tray icon tooltip reflects the current application state. During an active schedule: **current block name and remaining time** (e.g., *"Проект — 1ч 23мин"*). For off-schedule states, see §5.6. |
| F-10 | Clicking the tray icon opens the **main window**. |

### 5.3 Main Window

| # | Requirement |
|---|---|
| F-11 | The main window displays the **full schedule for the day** with the current block visually highlighted. For off-schedule states, see §5.6. |
| F-12 | The window provides a **"Пауза до следующего дня"** control, which silences all notifications until the start of the next working day. When paused, the control changes to **"Возобновить"**. Pause state **persists across application restarts**. |
| F-13 | The window provides access to the **schedule editor**. |
| F-14 | The window provides a **"Выход"** control to fully exit the application. |
| F-21 | Closing the main window via the **× button hides it to the system tray** and does not exit the application. The only way to fully exit is via F-14. |

### 5.4 Late Start and System Recovery

| # | Requirement |
|---|---|
| F-15 | On application start, or after **wake from sleep/hibernation, restart, or system time change**, the application determines the current block by system clock and operates from that point forward. |
| F-16 | Notifications missed while the application was not running (or the system was asleep) are **silently skipped** and not replayed. |

### 5.5 Schedule Editor

| # | Requirement |
|---|---|
| F-17 | The editor is a **graphical UI** embedded in the application (no manual file editing required). |
| F-18 | The editor allows modifying the **permanent schedule**. Changes take effect **immediately upon saving**: future notifications are recalculated, past notifications are not replayed. |
| F-19 | The editor allows creating or modifying a **daily override** for the current date only. Changes take effect immediately upon saving. The override **expires at midnight**, persists across application restarts within the same day, takes priority over the permanent schedule, and can be cancelled via **"Сбросить на основное расписание"**. |
| F-20 | The editor enforces a **strict, gap-free schedule**: blocks must be contiguous with no overlaps or empty time between them. |
| F-23 | On **first launch** (or if no schedule file is found), the application loads a **default schedule** pre-configured based on the user's standard study day. The user may edit it immediately. |

### 5.6 Off-schedule States

The application defines three off-schedule states:

| State | Condition | Tray tooltip | Main window |
|---|---|---|---|
| **Before Start** | Current time is before the first block | *"День начнётся в [time]"* | Full schedule displayed; no block highlighted |
| **After End** | Current time is after the last block | *"День завершён"* | Full schedule displayed; all blocks shown as past |
| **Weekend** | Saturday or Sunday | *"Выходной"* | *"Сегодня выходной — расписание неактивно"* |

> Note: past blocks in the main window reflect the schedule, not actual activity completion.

### 5.7 Reliability

| # | Requirement |
|---|---|
| F-24 | Each notification is identified by a composite key: **(date, block identifier, type: warning/transition)**. A notification with a given key is **fired at most once per day**, regardless of restarts or system time changes. The deduplication mechanism will be defined during System Design. |
| F-25 | Toast notification delivery depends on **Windows system notification settings** (Do Not Disturb, Focus Assist, per-app settings). The application does not override OS-level restrictions. If notifications appear to be suppressed at startup, the application shows a **one-time warning in the main window**. No popup fallback is provided in MVP. |

---

## 6. Non-Functional Requirements

| # | Requirement |
|---|---|
| NF-01 | Windows desktop application (target OS: Windows 10/11). |
| NF-02 | Auto-starts with the system; runs silently in the background with minimal resource usage. |
| NF-03 | No network connectivity required; fully offline. |
| NF-04 | All schedule data and application state (pause, daily override) are stored locally. |
| NF-05 | Each machine (home PC, laptop) is an independent instance with its own local data. |
| NF-06 | All UI text and notification messages are in **Russian**. Code and technical documentation are in **English**. |

---

## 7. Out of Scope

- Mobile application.
- Cloud sync or multi-device state sharing.
- Task management, notes, or tracking of completion.
- Statistics or analytics on schedule adherence.
- Multiple schedule profiles (e.g., per-user or per-project profiles).
- Weekend schedules (not planned at this stage).
- Popup fallback notifications (always-on-top overlay window).

---

## 8. Open Questions

| # | Question | Status |
|---|---|---|
| OQ-01 | Whether the application can reliably detect disabled Windows notifications at runtime (to trigger the F-25 warning). | 🔄 Deferred to System Design |
