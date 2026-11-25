import { useState } from 'react'
import ScheduleEditor from './components/ScheduleEditor'
import ScheduleView from './components/ScheduleView'
import { useScheduleState } from './hooks/useScheduleState'
import { ExitIcon, PauseIcon, PlayIcon } from './icons'

function App(): React.ReactElement {
  const { state, error } = useScheduleState()
  const [editing, setEditing] = useState(false)
  const [testStatus, setTestStatus] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function onPause(): Promise<void> {
    if (!state) return
    setActionError(null)
    try {
      if (state.paused) await window.api.resumeNotifications()
      else await window.api.pauseNotifications()
    } catch (pauseError) {
      console.error(pauseError)
      setActionError('Не удалось изменить паузу')
    }
  }

  async function onQuit(): Promise<void> {
    try {
      await window.api.quit()
    } catch (quitError) {
      console.error(quitError)
      setActionError('Не удалось закрыть приложение')
    }
  }

  async function onTestNotification(): Promise<void> {
    try {
      const result = await window.api.testNotification()
      setTestStatus(
        result.delivered
          ? 'Запрос отправлен. Если уведомления Windows разрешены, тост появится сейчас.'
          : 'Эта сессия не поддерживает системные уведомления.'
      )
    } catch (testError) {
      console.error(testError)
      setTestStatus('Не удалось отправить уведомление.')
    }
  }

  return (
    <div className="flex h-full min-h-screen flex-col bg-[#0b1120] text-slate-100">
      <div className="mx-auto flex h-full min-h-screen w-full max-w-md flex-col px-4 py-4">
        <div className="app-scroll min-h-0 flex-1 overflow-y-auto">
          {!state && !error ? <p className="text-sm text-slate-400">Загрузка…</p> : null}
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          {state && editing ? (
            <ScheduleEditor state={state} onClose={() => setEditing(false)} />
          ) : null}
          {state && !editing ? (
            <ScheduleView
              state={state}
              onEdit={() => setEditing(true)}
              onTestNotification={() => {
                void onTestNotification()
              }}
              testStatus={testStatus}
            />
          ) : null}
        </div>

        <footer className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={!state}
            onClick={() => {
              void onPause()
            }}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#151c2c] px-3 py-3 text-sm text-slate-100 disabled:opacity-50"
          >
            {state?.paused ? <PlayIcon className="h-4 w-4" /> : <PauseIcon className="h-4 w-4" />}
            {state?.paused ? 'Возобновить' : 'Пауза до завтра'}
          </button>
          <button
            type="button"
            onClick={() => {
              void onQuit()
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#151c2c] px-4 py-3 text-sm text-slate-100"
          >
            <ExitIcon className="h-4 w-4" />
            Выход
          </button>
        </footer>
        {actionError ? (
          <p className="mt-2 text-center text-xs text-rose-300">{actionError}</p>
        ) : null}
      </div>
    </div>
  )
}

export default App
