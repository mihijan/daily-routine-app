import type { ScheduleBlock, SchedulePhase, ScheduleViewState } from '../../shared/types'
import {
  formatCountdown,
  formatDateKey,
  formatLongDate,
  formatMinutesLeft,
  formatRange
} from '../format'
import { CalendarIcon, CheckIcon, ClockIcon, PencilIcon } from '../icons'

type BlockStatus = 'past' | 'current' | 'upcoming'

interface ScheduleViewProps {
  state: ScheduleViewState
  onEdit: () => void
}

function blockStatus(state: ScheduleViewState, block: ScheduleBlock, index: number): BlockStatus {
  if (state.phase === 'weekend' || state.phase === 'before-start') return 'upcoming'
  if (state.phase === 'after-end') return 'past'
  const currentIndex = state.effectiveSchedule.findIndex(
    (item) => item.id === state.currentBlock?.id
  )
  if (currentIndex === -1) return 'upcoming'
  if (index < currentIndex) return 'past'
  if (block.id === state.currentBlock?.id) return 'current'
  return 'upcoming'
}

function phaseBadge(phase: SchedulePhase, paused: boolean): string {
  if (paused) return 'Пауза'
  if (phase === 'active') return 'Активно'
  if (phase === 'before-start') return 'До начала'
  if (phase === 'after-end') return 'Завершён'
  return 'Выходной'
}

function StatusMark({ status }: { status: BlockStatus }): React.ReactElement {
  if (status === 'past') return <CheckIcon className="h-4 w-4 text-slate-600" />
  if (status === 'current') {
    return <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
  }
  return <ClockIcon className="h-4 w-4 text-slate-500" />
}

function Hero({ state }: { state: ScheduleViewState }): React.ReactElement {
  if (state.phase === 'weekend') {
    return (
      <section className="rounded-2xl bg-[#151c2c] px-4 py-6">
        <p className="text-xs text-slate-400">Сегодня</p>
        <h2 className="mt-2 text-2xl font-semibold">Сегодня выходной</h2>
        <p className="mt-2 text-sm text-slate-400">Расписание неактивно</p>
      </section>
    )
  }

  if (state.phase === 'before-start') {
    return (
      <section className="rounded-2xl bg-[#151c2c] px-4 py-5">
        <p className="text-xs text-slate-400">До начала дня</p>
        <p className="mt-3 font-mono text-5xl font-semibold tracking-tight text-emerald-400 tabular-nums">
          {formatCountdown(state.secondsUntilStart ?? 0)}
        </p>
        <p className="mt-3 text-sm text-slate-400">День начнётся в {state.dayStartTime}</p>
      </section>
    )
  }

  if (state.phase === 'after-end' || !state.currentBlock) {
    return (
      <section className="rounded-2xl bg-[#151c2c] px-4 py-6">
        <p className="text-xs text-slate-400">Сегодня</p>
        <h2 className="mt-2 text-2xl font-semibold">День завершён</h2>
        <p className="mt-2 text-sm text-slate-400">Можно отдыхать</p>
      </section>
    )
  }

  const progress = Math.round((state.progress ?? 0) * 100)

  return (
    <section className="rounded-2xl bg-[#151c2c] px-4 py-4">
      <p className="text-xs text-slate-400">Текущее занятие</p>
      <h2 className="mt-2 line-clamp-2 text-lg font-semibold leading-snug">
        {state.currentBlock.name}
      </h2>
      <p className="mt-3 font-mono text-5xl font-semibold tracking-tight text-emerald-400 tabular-nums">
        {formatCountdown(state.remainingSeconds ?? 0)}
      </p>
      <div
        className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-800"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Прогресс текущего занятия"
      >
        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-400">
        {formatRange(state.currentBlock.startTime, state.currentBlock.endTime)} · До окончания
        занятия
      </p>
      {state.paused && state.pausedUntil ? (
        <p className="mt-2 text-xs text-amber-300/90">
          Уведомления на паузе до {formatDateKey(state.pausedUntil)}
        </p>
      ) : null}
    </section>
  )
}

export default function ScheduleView({ state, onEdit }: ScheduleViewProps): React.ReactElement {
  const badge = phaseBadge(state.phase, state.paused)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CalendarIcon className="h-4 w-4 text-slate-300" />
            Daily Routine
          </div>
          <p className="mt-1 text-sm text-slate-400">{formatLongDate(state.now)}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            state.paused
              ? 'bg-amber-400/15 text-amber-200'
              : state.phase === 'active'
                ? 'bg-emerald-400/15 text-emerald-300'
                : 'bg-white/5 text-slate-300'
          }`}
        >
          {badge}
        </span>
      </header>

      <div className="mt-4 shrink-0">
        <Hero state={state} />
      </div>

      {state.phase !== 'weekend' ? (
        <div className="mt-3 grid shrink-0 grid-cols-2 gap-3">
          <section className="rounded-2xl border border-white/5 bg-[#121826] px-3 py-3">
            <p className="text-xs text-slate-500">Следующее занятие</p>
            {state.nextBlock ? (
              <>
                <p className="mt-2 line-clamp-2 text-sm font-medium">{state.nextBlock.name}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {formatRange(state.nextBlock.startTime, state.nextBlock.endTime)}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-400">Больше занятий нет</p>
            )}
          </section>
          <section className="rounded-2xl border border-white/5 bg-[#121826] px-3 py-3">
            <p className="text-xs text-slate-500">Окончание дня</p>
            <p className="mt-2 text-sm font-medium">{state.dayEndTime ?? '—'}</p>
            <p className="mt-1 text-xs text-slate-400">
              {state.phase === 'after-end'
                ? 'День завершён'
                : `Осталось ${formatMinutesLeft(state.secondsUntilDayEnd ?? 0)}`}
            </p>
          </section>
        </div>
      ) : null}

      <div className="mt-5 flex shrink-0 items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Расписание на сегодня</h2>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-white"
        >
          <PencilIcon className="h-3.5 w-3.5" />
          Редактировать
        </button>
      </div>
      {state.dailyOverride ? (
        <p className="mt-1 shrink-0 text-xs text-emerald-300/80">
          Действует расписание только на сегодня
        </p>
      ) : null}

      <ul className="app-scroll mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto">
        {state.effectiveSchedule.map((block, index) => {
          const status = blockStatus(state, block, index)
          return (
            <li
              key={block.id}
              aria-current={status === 'current' ? 'true' : undefined}
              className={`flex items-center gap-3 rounded-xl px-2 py-2 ${
                status === 'current' && state.phase !== 'weekend' ? 'bg-emerald-400/10' : ''
              }`}
            >
              <span className="w-[5.5rem] shrink-0 text-xs text-slate-500 tabular-nums">
                {formatRange(block.startTime, block.endTime)}
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-sm ${
                  state.phase === 'weekend' || status === 'past'
                    ? 'text-slate-500'
                    : status === 'current'
                      ? 'font-medium text-emerald-50'
                      : 'text-slate-200'
                }`}
              >
                {block.name}
              </span>
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                <StatusMark status={status} />
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
