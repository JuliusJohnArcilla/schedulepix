import { useCallback, useRef, useState } from 'react'
import type { Doc } from './types'

interface HState {
  past: Doc[]
  present: Doc | null
  future: Doc[]
}

/** Undo/redo. Edits sharing a `key` within 1s collapse into one undo step. */
export function useHistory() {
  const [s, setS] = useState<HState>({ past: [], present: null, future: [] })
  const last = useRef<{ key: string; t: number } | null>(null)

  const reset = useCallback((d: Doc) => {
    last.current = null
    setS({ past: [], present: d, future: [] })
  }, [])

  const commit = useCallback((fn: (d: Doc) => Doc, key?: string) => {
    const now = Date.now()
    const coalesce = !!key && !!last.current && last.current.key === key && now - last.current.t < 1000
    last.current = key ? { key, t: now } : null
    setS((st) => {
      if (!st.present) return st
      const next = fn(st.present)
      if (next === st.present) return st
      return { past: coalesce ? st.past : [...st.past.slice(-99), st.present], present: next, future: [] }
    })
  }, [])

  const undo = useCallback(() => {
    last.current = null
    setS((st) => (st.past.length && st.present ? { past: st.past.slice(0, -1), present: st.past[st.past.length - 1], future: [st.present, ...st.future] } : st))
  }, [])
  const redo = useCallback(() => {
    last.current = null
    setS((st) => (st.future.length && st.present ? { past: [...st.past, st.present], present: st.future[0], future: st.future.slice(1) } : st))
  }, [])

  return { doc: s.present, canUndo: s.past.length > 0, canRedo: s.future.length > 0, reset, commit, undo, redo }
}
