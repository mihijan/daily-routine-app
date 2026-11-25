import type { ScheduleBlock } from '../shared/types'

/**
 * Study day agreed during requirements: 13 contiguous blocks, 10:00–21:00.
 * Weekends are not represented here — the scheduler will stay silent on Saturday and Sunday.
 */
export const DEFAULT_SCHEDULE: readonly ScheduleBlock[] = Object.freeze([
  Object.freeze({
    id: 'typing-1',
    name: 'Слепая печать №1',
    startTime: '10:00',
    endTime: '10:10'
  }),
  Object.freeze({
    id: 'project-architecture',
    name: 'Проект — разработка и архитектура',
    startTime: '10:10',
    endTime: '12:10'
  }),
  Object.freeze({
    id: 'break-1',
    name: 'Перерыв — 15 минут',
    startTime: '12:10',
    endTime: '12:25'
  }),
  Object.freeze({
    id: 'project-implementation',
    name: 'Проект — реализация, тестирование',
    startTime: '12:25',
    endTime: '14:25'
  }),
  Object.freeze({
    id: 'lunch',
    name: 'Обед — 45 минут',
    startTime: '14:25',
    endTime: '15:10'
  }),
  Object.freeze({
    id: 'typing-2',
    name: 'Слепая печать №2',
    startTime: '15:10',
    endTime: '15:20'
  }),
  Object.freeze({
    id: 'algorithms',
    name: 'Алгоритмы',
    startTime: '15:20',
    endTime: '16:50'
  }),
  Object.freeze({
    id: 'walk',
    name: 'Прогулка / отдых',
    startTime: '16:50',
    endTime: '17:10'
  }),
  Object.freeze({
    id: 'technical-skills',
    name: 'Технические компетенции',
    startTime: '17:10',
    endTime: '18:40'
  }),
  Object.freeze({
    id: 'dinner',
    name: 'Ужин / отдых',
    startTime: '18:40',
    endTime: '19:10'
  }),
  Object.freeze({
    id: 'english',
    name: 'Английский',
    startTime: '19:10',
    endTime: '20:40'
  }),
  Object.freeze({
    id: 'typing-3',
    name: 'Слепая печать №3',
    startTime: '20:40',
    endTime: '20:50'
  }),
  Object.freeze({
    id: 'day-review',
    name: 'Итоги дня, план на завтра',
    startTime: '20:50',
    endTime: '21:00'
  })
])

export function cloneDefaultSchedule(): ScheduleBlock[] {
  return DEFAULT_SCHEDULE.map((block) => ({ ...block }))
}
