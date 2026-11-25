import { useEffect, useState } from 'react'
import type { ScheduleViewState } from '../../shared/types'

export function useScheduleState(): {
  state: ScheduleViewState | null
  error: string | null
} {
  const [state, setState] = useState<ScheduleViewState | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    window.api
      .getState()
      .then((next) => {
        if (!active) return
        setState(next)
        setError(null)
      })
      .catch(() => {
        if (active) setError('Не удалось получить состояние')
      })

    const unsubscribe = window.api.onState((next) => {
      setState(next)
      setError(null)
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return { state, error }
}
