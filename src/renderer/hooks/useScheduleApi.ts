// useScheduleApi — typed wrapper over window.api (contextBridge).
// Provides React-friendly access to IPC methods.
// Will be implemented during Bootstrap / Data Modeling tasks.

export function useScheduleApi(): Record<string, never> {
  return window.api
}
