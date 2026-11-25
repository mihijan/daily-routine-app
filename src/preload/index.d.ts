import type { TestNotificationResult } from '../shared/ipc-contracts'

interface DailyRoutineApi {
  testNotification: () => Promise<TestNotificationResult>
}

declare global {
  interface Window {
    api: DailyRoutineApi
  }
}

export {}
