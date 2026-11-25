import type { ScheduleValidationCode, ScheduleValidationError } from '../shared/types'

const VALIDATION_TEXT: Record<ScheduleValidationCode, string> = {
  'invalid-schedule': 'Расписание передано в неверном формате',
  'empty-schedule': 'Добавьте хотя бы один блок',
  'invalid-block': 'Блок заполнен не полностью',
  'empty-id': 'У блока нет идентификатора',
  'duplicate-id': 'Идентификатор блока повторяется',
  'empty-name': 'Укажите название',
  'invalid-time': 'Время должно быть в формате ЧЧ:ММ',
  'invalid-interval': 'Окончание должно быть позже начала',
  gap: 'Между блоками есть пропуск',
  overlap: 'Блоки пересекаются'
}

export function formatValidationError(error: ScheduleValidationError): string {
  const text = VALIDATION_TEXT[error.code]
  if (error.blockIndex === undefined) return text
  return `Блок ${error.blockIndex + 1}: ${text}`
}

export function formatLongDate(iso: string): string {
  const formatted = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date(iso))
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

export function formatDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(
    new Date(year, month - 1, day)
  )
}

/** `MM:SS`, or `H:MM:SS` when an hour or more remains. */
export function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, totalSeconds)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(rest).padStart(2, '0')
  if (hours > 0) return `${hours}:${mm}:${ss}`
  return `${mm}:${ss}`
}

export function formatMinutesLeft(totalSeconds: number): string {
  const minutes = Math.max(0, Math.ceil(totalSeconds / 60))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours > 0 && rest > 0) return `${hours} ч. ${rest} мин.`
  if (hours > 0) return `${hours} ч.`
  return `${minutes} мин.`
}

export function formatRange(start: string, end: string): string {
  return `${start}–${end}`
}

/** Adds minutes to `HH:mm` for a new draft block. Does not validate the schedule. */
export function addMinutes(time: string, minutes: number): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time)
  if (!match) return time
  const total = Math.min(23 * 60 + 59, Number(match[1]) * 60 + Number(match[2]) + minutes)
  const hours = Math.floor(total / 60)
  const mins = total % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}
