import type { PrepareScheduleResult, ScheduleBlock, ScheduleViewState } from './types'

export const IPC_CHANNELS = {
  getState: 'schedule:get-state',
  state: 'schedule:state',
  savePermanentSchedule: 'schedule:save-permanent',
  saveDailyOverride: 'schedule:save-override',
  resetDailyOverride: 'schedule:reset-override',
  pauseNotifications: 'schedule:pause',
  resumeNotifications: 'schedule:resume',
  quit: 'app:quit',
  testNotification: 'notifications:test'
} as const

export type TestNotificationResult = {
  delivered: boolean
}

export interface DailyRoutineApi {
  getState: () => Promise<ScheduleViewState>
  onState: (listener: (state: ScheduleViewState) => void) => () => void
  savePermanentSchedule: (blocks: ScheduleBlock[]) => Promise<PrepareScheduleResult>
  saveDailyOverride: (blocks: ScheduleBlock[]) => Promise<PrepareScheduleResult>
  resetDailyOverride: () => Promise<void>
  pauseNotifications: () => Promise<void>
  resumeNotifications: () => Promise<void>
  quit: () => Promise<void>
  testNotification: () => Promise<TestNotificationResult>
}
