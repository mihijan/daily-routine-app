import Store from 'electron-store'
import { cloneDefaultSchedule } from '../../domain/defaultSchedule'
import { resolveEffectiveSchedule } from '../../domain/schedule'
import {
  isDateKey,
  pauseUntilNextWorkingDay,
  pruneNotificationLog,
  resolvePauseState,
  toDateKey
} from '../../domain/time'
import { prepareSchedule, type PrepareScheduleResult } from '../../domain/validation'
import type {
  AppState,
  DailyOverride,
  NotificationLogEntry,
  PauseState,
  ScheduleBlock
} from '../../shared/types'

export const SCHEMA_VERSION = 1

const STORE_NAME = 'app-state'

interface StoreSchema {
  schemaVersion: number
  permanentSchedule: ScheduleBlock[]
  dailyOverride: DailyOverride | null
  pauseState: PauseState
  notificationLog: NotificationLogEntry[]
  /** Windows login item. Defaults to on; the tray checkbox is the user control. */
  openAtLogin: boolean
}

export interface AppStateRepositoryOptions {
  /**
   * Absolute directory for the JSON file.
   * Omit in production so electron-store uses Electron's userData directory.
   */
  cwd?: string
}

function defaultPauseState(): PauseState {
  return { paused: false, pausedUntil: null }
}

function isScheduleBlock(value: unknown): value is ScheduleBlock {
  if (typeof value !== 'object' || value === null) return false
  const block = value as ScheduleBlock
  return (
    typeof block.id === 'string' &&
    typeof block.name === 'string' &&
    typeof block.startTime === 'string' &&
    typeof block.endTime === 'string'
  )
}

function isScheduleBlockArray(value: unknown): value is ScheduleBlock[] {
  return Array.isArray(value) && value.every(isScheduleBlock)
}

function isDailyOverride(value: unknown): value is DailyOverride {
  if (typeof value !== 'object' || value === null) return false
  const override = value as DailyOverride
  return (
    typeof override.date === 'string' &&
    isDateKey(override.date) &&
    isScheduleBlockArray(override.blocks)
  )
}

function isPauseState(value: unknown): value is PauseState {
  if (typeof value !== 'object' || value === null) return false
  const state = value as PauseState
  if (typeof state.paused !== 'boolean') return false
  if (state.paused) return typeof state.pausedUntil === 'string' && isDateKey(state.pausedUntil)
  return state.pausedUntil === null
}

function isNotificationLogEntry(value: unknown): value is NotificationLogEntry {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as NotificationLogEntry
  return (
    typeof entry.date === 'string' &&
    isDateKey(entry.date) &&
    typeof entry.blockId === 'string' &&
    entry.blockId.trim().length > 0 &&
    (entry.type === 'warning' || entry.type === 'transition') &&
    typeof entry.firedAt === 'string' &&
    !Number.isNaN(Date.parse(entry.firedAt))
  )
}

/**
 * Owns the electron-store file and the in-memory copy of application state.
 * After `init()`, reads come from memory. Each write updates memory and the file.
 * Schedule rules are enforced before a write; an invalid schedule leaves the file unchanged.
 */
export class AppStateRepository {
  private readonly store: Store<StoreSchema>
  private cache: AppState | null = null

  constructor(options: AppStateRepositoryOptions = {}) {
    this.store = new Store<StoreSchema>({
      name: STORE_NAME,
      cwd: options.cwd,
      defaults: {
        schemaVersion: SCHEMA_VERSION,
        permanentSchedule: cloneDefaultSchedule(),
        dailyOverride: null,
        pauseState: defaultPauseState(),
        notificationLog: [],
        openAtLogin: true
      }
    })
  }

  /**
   * Load the file into memory.
   * A daily override for another date is cleared, an elapsed pause is cleared, and dedup entries
   * older than yesterday are dropped. A missing file, or a value with the wrong shape, falls back
   * to the default for that key. Calling `init()` again re-reads the file.
   */
  init(now: Date = new Date()): void {
    const loaded: AppState = {
      schemaVersion: this.readSchemaVersion(),
      permanentSchedule: this.readPermanentSchedule(),
      dailyOverride: this.readDailyOverride(),
      pauseState: resolvePauseState(this.readPauseState(), now),
      notificationLog: pruneNotificationLog(this.readNotificationLog(), now)
    }

    if (loaded.dailyOverride && loaded.dailyOverride.date !== toDateKey(now)) {
      loaded.dailyOverride = null
    }

    this.cache = loaded
    this.persist(loaded)
  }

  getInMemoryState(now: Date = new Date()): AppState {
    this.applyOverrideExpiry(now)
    this.applyPauseExpiry(now)
    this.applyLogRetention(now)
    return structuredClone(this.ensureInitialized())
  }

  getPermanentSchedule(): ScheduleBlock[] {
    return this.ensureInitialized().permanentSchedule.map((block) => ({ ...block }))
  }

  /** Replace the permanent schedule. Returns validation errors and does not write when invalid. */
  savePermanentSchedule(blocks: readonly ScheduleBlock[]): PrepareScheduleResult {
    const state = this.ensureInitialized()
    const prepared = prepareSchedule(blocks)
    if (!prepared.ok) return prepared

    this.store.set('permanentSchedule', prepared.blocks)
    state.permanentSchedule = prepared.blocks
    return { ok: true, blocks: prepared.blocks.map((block) => ({ ...block })) }
  }

  getDailyOverride(now: Date = new Date()): DailyOverride | null {
    this.applyOverrideExpiry(now)
    const override = this.ensureInitialized().dailyOverride
    return override ? structuredClone(override) : null
  }

  /**
   * Create or replace the override for `now`'s local date.
   * The date is taken from `now`, not from the caller, because an override exists only for today.
   */
  saveDailyOverride(
    blocks: readonly ScheduleBlock[],
    now: Date = new Date()
  ): PrepareScheduleResult {
    const state = this.ensureInitialized()
    const prepared = prepareSchedule(blocks)
    if (!prepared.ok) return prepared

    const override: DailyOverride = { date: toDateKey(now), blocks: prepared.blocks }
    this.store.set('dailyOverride', override)
    state.dailyOverride = override
    return { ok: true, blocks: prepared.blocks.map((block) => ({ ...block })) }
  }

  resetDailyOverride(): void {
    const state = this.ensureInitialized()
    this.store.set('dailyOverride', null)
    state.dailyOverride = null
  }

  /** Permanent schedule, replaced by today's override when one is stored. Expires a stale override. */
  getEffectiveSchedule(now: Date = new Date()): ScheduleBlock[] {
    this.applyOverrideExpiry(now)
    const state = this.ensureInitialized()
    return resolveEffectiveSchedule(state.permanentSchedule, state.dailyOverride, toDateKey(now))
  }

  /**
   * Silence notifications until the start of the next working day.
   * The scheduler must `reconcile()` after this so a boundary already in the past is not fired.
   */
  pauseNotifications(now: Date = new Date()): PauseState {
    const pauseState = pauseUntilNextWorkingDay(now)
    this.setPauseState(pauseState)
    return pauseState
  }

  /** Manual resume. The scheduler must `reconcile()` after this. */
  resumeNotifications(): void {
    this.setPauseState({ paused: false, pausedUntil: null })
  }

  /** Persist the pause flag as given. Does not calculate the next working day. */
  setPauseState(pauseState: PauseState): void {
    if (!isPauseState(pauseState)) {
      throw new Error(
        'Pause state must be inactive with pausedUntil null, or paused with a YYYY-MM-DD pausedUntil'
      )
    }

    const state = this.ensureInitialized()
    const next = { paused: pauseState.paused, pausedUntil: pauseState.pausedUntil }
    this.store.set('pauseState', next)
    state.pauseState = next
  }

  /** Whether the app should register itself to start with Windows. Default is on. */
  isOpenAtLogin(): boolean {
    return this.store.get('openAtLogin') !== false
  }

  setOpenAtLogin(enabled: boolean): void {
    this.store.set('openAtLogin', enabled)
  }

  /** Append one fired-notification record. Does not decide whether it should have fired. */
  appendNotification(entry: NotificationLogEntry): void {
    if (!isNotificationLogEntry(entry)) {
      throw new Error('Notification log entry is missing a date, block id, type, or timestamp')
    }

    const state = this.ensureInitialized()
    const next = [...state.notificationLog, { ...entry, blockId: entry.blockId.trim() }]
    this.store.set('notificationLog', next)
    state.notificationLog = next
  }

  private ensureInitialized(): AppState {
    if (!this.cache) {
      throw new Error('AppStateRepository.init() must be called before use')
    }
    return this.cache
  }

  private applyOverrideExpiry(now: Date): void {
    const state = this.ensureInitialized()
    if (!state.dailyOverride || state.dailyOverride.date === toDateKey(now)) return

    this.store.set('dailyOverride', null)
    state.dailyOverride = null
  }

  private applyPauseExpiry(now: Date): void {
    const state = this.ensureInitialized()
    const resolved = resolvePauseState(state.pauseState, now)
    if (
      resolved.paused === state.pauseState.paused &&
      resolved.pausedUntil === state.pauseState.pausedUntil
    ) {
      return
    }

    this.store.set('pauseState', resolved)
    state.pauseState = resolved
  }

  private applyLogRetention(now: Date): void {
    const state = this.ensureInitialized()
    const pruned = pruneNotificationLog(state.notificationLog, now)
    if (pruned.length === state.notificationLog.length) return

    this.store.set('notificationLog', pruned)
    state.notificationLog = pruned
  }

  private persist(state: AppState): void {
    this.store.set({
      schemaVersion: state.schemaVersion,
      permanentSchedule: state.permanentSchedule,
      dailyOverride: state.dailyOverride,
      pauseState: state.pauseState,
      notificationLog: state.notificationLog
    })
  }

  private readSchemaVersion(): number {
    const value = this.store.get('schemaVersion')
    return typeof value === 'number' && Number.isInteger(value) ? value : SCHEMA_VERSION
  }

  private readPermanentSchedule(): ScheduleBlock[] {
    const value = this.store.get('permanentSchedule')
    return isScheduleBlockArray(value)
      ? value.map((block) => ({ ...block }))
      : cloneDefaultSchedule()
  }

  private readDailyOverride(): DailyOverride | null {
    const value = this.store.get('dailyOverride')
    if (value === null || value === undefined) return null
    if (!isDailyOverride(value)) return null
    return { date: value.date, blocks: value.blocks.map((block) => ({ ...block })) }
  }

  private readPauseState(): PauseState {
    const value = this.store.get('pauseState')
    if (!isPauseState(value)) return defaultPauseState()
    return { paused: value.paused, pausedUntil: value.pausedUntil }
  }

  private readNotificationLog(): NotificationLogEntry[] {
    const value = this.store.get('notificationLog')
    if (!Array.isArray(value)) return []
    return value.filter(isNotificationLogEntry).map((entry) => ({ ...entry }))
  }
}
