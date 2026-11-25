import { useState } from 'react'
import type { ScheduleBlock, ScheduleValidationError, ScheduleViewState } from '../../shared/types'
import { addMinutes, formatValidationError } from '../format'

type EditorMode = 'permanent' | 'today'

interface ScheduleEditorProps {
  state: ScheduleViewState
  onClose: () => void
}

function copyBlocks(blocks: readonly ScheduleBlock[]): ScheduleBlock[] {
  return blocks.map((block) => ({ ...block }))
}

function draftFor(state: ScheduleViewState, mode: EditorMode): ScheduleBlock[] {
  if (mode === 'today') return copyBlocks(state.dailyOverride?.blocks ?? state.permanentSchedule)
  return copyBlocks(state.permanentSchedule)
}

function createBlock(existing: readonly ScheduleBlock[]): ScheduleBlock {
  const startTime = existing[existing.length - 1]?.endTime ?? '10:00'
  return {
    id: crypto.randomUUID(),
    name: 'Новый блок',
    startTime,
    endTime: addMinutes(startTime, 30)
  }
}

function timeValue(value: string): string {
  return value.slice(0, 5)
}

export default function ScheduleEditor({
  state,
  onClose
}: ScheduleEditorProps): React.ReactElement {
  const [mode, setMode] = useState<EditorMode>(state.dailyOverride ? 'today' : 'permanent')
  const [blocks, setBlocks] = useState<ScheduleBlock[]>(() => draftFor(state, mode))
  const [errors, setErrors] = useState<ScheduleValidationError[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function switchMode(next: EditorMode): void {
    if (next === mode) return
    setMode(next)
    setBlocks(draftFor(state, next))
    setErrors([])
    setFormError(null)
  }

  function updateBlock(id: string, patch: Partial<ScheduleBlock>): void {
    setBlocks((current) =>
      current.map((block) => (block.id === id ? { ...block, ...patch } : block))
    )
  }

  async function onSave(): Promise<void> {
    setSaving(true)
    setFormError(null)
    try {
      const result =
        mode === 'permanent'
          ? await window.api.savePermanentSchedule(blocks)
          : await window.api.saveDailyOverride(blocks)
      if (!result.ok) {
        setErrors(result.errors)
        return
      }
      onClose()
    } catch (error) {
      console.error(error)
      setFormError('Не удалось сохранить расписание')
    } finally {
      setSaving(false)
    }
  }

  async function onReset(): Promise<void> {
    setSaving(true)
    setFormError(null)
    try {
      await window.api.resetDailyOverride()
      onClose()
    } catch (error) {
      console.error(error)
      setFormError('Не удалось сбросить расписание на сегодня')
    } finally {
      setSaving(false)
    }
  }

  const invalidIndexes = new Set(
    errors.flatMap((error) => (error.blockIndex === undefined ? [] : [error.blockIndex]))
  )

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Редактор расписания</h2>
        <button type="button" onClick={onClose} className="text-sm text-slate-400 hover:text-white">
          Закрыть
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-[#121826] p-1">
        <button
          type="button"
          onClick={() => switchMode('permanent')}
          className={`rounded-lg px-3 py-2 text-sm ${
            mode === 'permanent' ? 'bg-[#1c2638] text-white' : 'text-slate-400'
          }`}
        >
          Основное
        </button>
        <button
          type="button"
          onClick={() => switchMode('today')}
          className={`rounded-lg px-3 py-2 text-sm ${
            mode === 'today' ? 'bg-[#1c2638] text-white' : 'text-slate-400'
          }`}
        >
          Только сегодня
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {mode === 'today'
          ? 'Эти блоки заменят основное расписание до полуночи.'
          : 'Изменения основного расписания начнут действовать сразу.'}
      </p>

      <ul className="mt-4 space-y-3">
        {blocks.map((block, index) => (
          <li
            key={block.id}
            className={`rounded-xl bg-[#151c2c] p-3 ${
              invalidIndexes.has(index) ? 'ring-1 ring-rose-400/70' : ''
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500">Блок {index + 1}</span>
              <button
                type="button"
                onClick={() =>
                  setBlocks((current) => current.filter((item) => item.id !== block.id))
                }
                className="text-xs text-slate-400 hover:text-rose-300"
              >
                Удалить
              </button>
            </div>
            <label className="mt-2 block text-xs text-slate-400">
              Название
              <input
                value={block.name}
                onChange={(event) => updateBlock(block.id, { name: event.target.value })}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1120] px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60"
              />
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-400">
                Начало
                <input
                  type="time"
                  step={60}
                  value={timeValue(block.startTime)}
                  onChange={(event) =>
                    updateBlock(block.id, { startTime: timeValue(event.target.value) })
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1120] px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60"
                />
              </label>
              <label className="text-xs text-slate-400">
                Конец
                <input
                  type="time"
                  step={60}
                  value={timeValue(block.endTime)}
                  onChange={(event) =>
                    updateBlock(block.id, { endTime: timeValue(event.target.value) })
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1120] px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60"
                />
              </label>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setBlocks((current) => [...current, createBlock(current)])}
        className="mt-3 w-full rounded-xl border border-dashed border-white/15 py-2 text-sm text-slate-300 hover:border-white/30 hover:text-white"
      >
        Добавить блок
      </button>

      {errors.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm text-rose-300">
          {errors.map((error, index) => (
            <li key={`${error.code}-${error.blockIndex ?? 'all'}-${index}`}>
              {formatValidationError(error)}
            </li>
          ))}
        </ul>
      ) : null}
      {formError ? <p className="mt-3 text-sm text-rose-300">{formError}</p> : null}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            void onSave()
          }}
          className="flex-1 rounded-xl bg-emerald-400 py-2.5 text-sm font-medium text-slate-950 disabled:opacity-60"
        >
          Сохранить
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onClose}
          className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-200"
        >
          Отмена
        </button>
      </div>

      {state.dailyOverride ? (
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            void onReset()
          }}
          className="mt-3 w-full text-sm text-slate-400 hover:text-white disabled:opacity-60"
        >
          Сбросить на основное расписание
        </button>
      ) : null}
    </div>
  )
}
