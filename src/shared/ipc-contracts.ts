// IPC channel names shared by Main and Preload.
// Schedule editor channels are added with the editor. This phase only exposes a manual notification check.

export const IPC_CHANNELS = {
  testNotification: 'notifications:test'
} as const

export type TestNotificationResult = {
  delivered: boolean
}
