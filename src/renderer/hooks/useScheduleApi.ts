// Typed wrapper over window.api. Schedule methods are added with the editor.

export function useScheduleApi(): Window['api'] {
  return window.api
}
