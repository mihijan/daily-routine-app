import type { DailyRoutineApi } from '../shared/ipc-contracts'

declare global {
  interface Window {
    api: DailyRoutineApi
  }
}

export {}
