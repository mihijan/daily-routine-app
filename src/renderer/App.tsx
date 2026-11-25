import { useState } from 'react'

// Schedule view and editor come later. The button only checks that Windows can show a toast.

function App(): React.ReactElement {
  const [status, setStatus] = useState<string | null>(null)

  async function onTestNotification(): Promise<void> {
    if (!window.api?.testNotification) {
      setStatus('Мост к приложению недоступен.')
      return
    }

    try {
      const result = await window.api.testNotification()
      setStatus(
        result.delivered
          ? 'Запрос отправлен. Если уведомления Windows разрешены, тост появится сейчас.'
          : 'Эта сессия не поддерживает системные уведомления.'
      )
    } catch (error) {
      console.error(error)
      setStatus('Не удалось отправить уведомление.')
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Daily Routine</h1>
        <p className="mt-2 text-gray-400">Персональный планировщик учебного дня</p>
        <button
          type="button"
          className="mt-8 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200"
          onClick={() => {
            void onTestNotification()
          }}
        >
          Проверить уведомление
        </button>
        {status ? <p className="mt-4 max-w-md text-sm text-gray-300">{status}</p> : null}
      </div>
    </div>
  )
}

export default App
