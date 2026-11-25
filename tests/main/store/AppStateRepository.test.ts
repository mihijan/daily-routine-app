import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cloneDefaultSchedule, DEFAULT_SCHEDULE } from '../../../src/domain/defaultSchedule'
import { AppStateRepository } from '../../../src/main/store/AppStateRepository'
import type { ScheduleBlock } from '../../../src/shared/types'

vi.mock('electron', () => ({
  app: {
    getPath: () => tmpdir(),
    getName: () => 'daily-routine',
    getVersion: () => '0.1.0'
  },
  ipcMain: {
    on: () => undefined
  },
  shell: {
    openPath: async () => ''
  }
}))

const TODAY = new Date(2026, 10, 25, 15, 0, 0)
const TOMORROW = new Date(2026, 10, 26, 0, 5, 0)

function day(start: string, end: string, id = 'block', name = 'Блок'): ScheduleBlock {
  return { id, name, startTime: start, endTime: end }
}

describe('AppStateRepository', () => {
  let cwd: string

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'daily-routine-'))
  })

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true })
  })

  function open(now: Date = TODAY): AppStateRepository {
    const repository = new AppStateRepository({ cwd })
    repository.init(now)
    return repository
  }

  it('starts with Windows autostart enabled and remembers a later choice', () => {
    const repository = open()
    expect(repository.isOpenAtLogin()).toBe(true)
    repository.setOpenAtLogin(false)

    const restarted = open()
    expect(restarted.isOpenAtLogin()).toBe(false)
  })

  it('loads the default schedule on first launch', () => {
    const repository = open()
    const loaded = repository.getPermanentSchedule()
    expect(loaded).toEqual(cloneDefaultSchedule())
    loaded[0].name = 'Изменено'
    expect(repository.getPermanentSchedule()[0].name).toBe(DEFAULT_SCHEDULE[0].name)
    expect(repository.getEffectiveSchedule(TODAY)).toEqual(cloneDefaultSchedule())
    expect(repository.getInMemoryState(TODAY).schemaVersion).toBe(1)
    expect(repository.getDailyOverride(TODAY)).toBeNull()
  })

  it('refuses to read or write before init', () => {
    const repository = new AppStateRepository({ cwd })
    expect(() => repository.getPermanentSchedule()).toThrow(/init/)
  })

  it('persists a permanent schedule across a new repository instance', () => {
    const saved = [
      day('09:00', '12:00', 'morning', 'Утро'),
      day('12:00', '18:00', 'afternoon', 'День')
    ]
    const repository = open()
    expect(repository.savePermanentSchedule(saved).ok).toBe(true)

    const restarted = open()
    expect(restarted.getPermanentSchedule()).toEqual(saved)
  })

  it('does not save an invalid permanent schedule', () => {
    const repository = open()
    const result = repository.savePermanentSchedule([
      day('10:00', '11:00', 'first', 'Первый'),
      day('12:00', '13:00', 'second', 'Второй')
    ])

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.map((error) => error.code)).toEqual(['gap'])
    expect(repository.getPermanentSchedule()).toEqual(cloneDefaultSchedule())

    const restarted = open()
    expect(restarted.getPermanentSchedule()).toEqual(cloneDefaultSchedule())
  })

  it('gives today override priority and keeps it across a restart on the same date', () => {
    const override = [day('10:00', '21:00', 'custom', 'Свой день')]
    const repository = open()
    expect(repository.saveDailyOverride(override, TODAY).ok).toBe(true)

    expect(repository.getEffectiveSchedule(TODAY)).toEqual(override)
    expect(repository.getPermanentSchedule()).toEqual(cloneDefaultSchedule())
    expect(repository.getDailyOverride(TODAY)?.date).toBe('2026-11-25')

    const restarted = open(TODAY)
    expect(restarted.getEffectiveSchedule(TODAY)).toEqual(override)
    expect(restarted.getPermanentSchedule()).toEqual(cloneDefaultSchedule())
  })

  it('replaces an existing override and can reset it back to the permanent schedule', () => {
    const first = [day('10:00', '21:00', 'first', 'Первый')]
    const second = [day('08:00', '20:00', 'second', 'Второй')]
    const repository = open()

    repository.saveDailyOverride(first, TODAY)
    repository.saveDailyOverride(second, TODAY)
    expect(repository.getEffectiveSchedule(TODAY)).toEqual(second)

    repository.resetDailyOverride()
    expect(repository.getDailyOverride(TODAY)).toBeNull()
    expect(repository.getEffectiveSchedule(TODAY)).toEqual(cloneDefaultSchedule())

    const restarted = open(TODAY)
    expect(restarted.getDailyOverride(TODAY)).toBeNull()
    expect(restarted.getEffectiveSchedule(TODAY)).toEqual(cloneDefaultSchedule())
  })

  it('does not replace a valid override with an invalid one', () => {
    const repository = open()
    repository.saveDailyOverride([day('10:00', '21:00', 'custom', 'Свой день')], TODAY)

    const result = repository.saveDailyOverride([day('10:00', '11:00', 'broken', '   ')], TODAY)
    expect(result.ok).toBe(false)
    expect(repository.getEffectiveSchedule(TODAY)[0].id).toBe('custom')
  })

  it('drops an override after midnight while the process stays open', () => {
    const repository = open(TODAY)
    repository.saveDailyOverride([day('10:00', '21:00', 'custom', 'Свой день')], TODAY)

    expect(repository.getEffectiveSchedule(TOMORROW)).toEqual(cloneDefaultSchedule())
    expect(repository.getDailyOverride(TOMORROW)).toBeNull()
  })

  it('drops a stored override from a previous date when the app starts', () => {
    const repository = open(TODAY)
    repository.saveDailyOverride([day('10:00', '21:00', 'custom', 'Свой день')], TODAY)

    const restarted = open(TOMORROW)
    expect(restarted.getInMemoryState(TOMORROW).dailyOverride).toBeNull()
    expect(restarted.getEffectiveSchedule(TOMORROW).map((block) => block.id)).toEqual(
      DEFAULT_SCHEDULE.map((block) => block.id)
    )
  })

  it('keeps a permanent-schedule edit from changing the effective schedule while an override is active', () => {
    const repository = open()
    const override = [day('10:00', '21:00', 'custom', 'Свой день')]
    repository.saveDailyOverride(override, TODAY)
    repository.savePermanentSchedule([day('08:00', '22:00', 'edited', 'Новая база')])

    expect(repository.getEffectiveSchedule(TODAY)).toEqual(override)
    expect(repository.getPermanentSchedule()[0].id).toBe('edited')
  })

  it('persists pause state and the notification log across a restart', () => {
    const repository = open()
    repository.setPauseState({ paused: true, pausedUntil: '2026-11-26' })
    repository.appendNotification({
      date: '2026-11-25',
      blockId: 'algorithms',
      type: 'warning',
      firedAt: '2026-11-25T14:48:00.000Z'
    })

    const restarted = open()
    const state = restarted.getInMemoryState(TODAY)
    expect(state.pauseState).toEqual({ paused: true, pausedUntil: '2026-11-26' })
    expect(state.notificationLog).toEqual([
      {
        date: '2026-11-25',
        blockId: 'algorithms',
        type: 'warning',
        firedAt: '2026-11-25T14:48:00.000Z'
      }
    ])
  })

  it('does not persist an invalid pause state or notification entry', () => {
    const repository = open()
    expect(() => repository.setPauseState({ paused: true, pausedUntil: null })).toThrow(
      /Pause state/
    )
    expect(() =>
      repository.appendNotification({
        date: '2026-11-25',
        blockId: 'algorithms',
        type: 'warning',
        firedAt: 'not-a-timestamp'
      })
    ).toThrow(/Notification log/)

    const state = repository.getInMemoryState(TODAY)
    expect(state.pauseState).toEqual({ paused: false, pausedUntil: null })
    expect(state.notificationLog).toEqual([])
  })

  it('falls back to defaults when stored values have the wrong shape', () => {
    writeFileSync(
      join(cwd, 'app-state.json'),
      JSON.stringify({
        schemaVersion: 'nope',
        permanentSchedule: { broken: true },
        dailyOverride: { date: 'yesterday', blocks: [] },
        pauseState: { paused: 'yes' },
        notificationLog: { not: 'an array' }
      })
    )

    const repository = open()
    const state = repository.getInMemoryState(TODAY)
    expect(state.schemaVersion).toBe(1)
    expect(state.permanentSchedule).toEqual(cloneDefaultSchedule())
    expect(state.dailyOverride).toBeNull()
    expect(state.pauseState).toEqual({ paused: false, pausedUntil: null })
    expect(state.notificationLog).toEqual([])
  })

  it('pauses until the next working day and clears the flag when that day starts', () => {
    const repository = open(TODAY)
    expect(repository.pauseNotifications(TODAY)).toEqual({
      paused: true,
      pausedUntil: '2026-11-26'
    })

    const friday = new Date(2026, 10, 27, 18, 0, 0)
    expect(repository.pauseNotifications(friday).pausedUntil).toBe('2026-11-30')

    expect(repository.getInMemoryState(new Date(2026, 10, 30, 0, 0, 0)).pauseState).toEqual({
      paused: false,
      pausedUntil: null
    })

    const restarted = open(new Date(2026, 10, 30, 8, 0, 0))
    expect(restarted.getInMemoryState().pauseState.paused).toBe(false)
  })

  it('drops notification log entries older than yesterday', () => {
    writeFileSync(
      join(cwd, 'app-state.json'),
      JSON.stringify({
        schemaVersion: 1,
        permanentSchedule: cloneDefaultSchedule(),
        dailyOverride: null,
        pauseState: { paused: false, pausedUntil: null },
        notificationLog: [
          {
            date: '2026-11-23',
            blockId: 'old',
            type: 'warning',
            firedAt: '2026-11-23T08:00:00.000Z'
          },
          {
            date: '2026-11-24',
            blockId: 'yesterday',
            type: 'transition',
            firedAt: '2026-11-24T08:00:00.000Z'
          },
          {
            date: '2026-11-25',
            blockId: 'today',
            type: 'transition',
            firedAt: '2026-11-25T08:00:00.000Z'
          }
        ]
      })
    )

    const repository = open(TODAY)
    expect(repository.getInMemoryState(TODAY).notificationLog.map((entry) => entry.date)).toEqual([
      '2026-11-24',
      '2026-11-25'
    ])

    expect(
      repository.getInMemoryState(TOMORROW).notificationLog.map((entry) => entry.blockId)
    ).toEqual(['today'])
  })
})
