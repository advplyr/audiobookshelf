import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/** Variables a theme may set. Matches the tokens in index.css. */
export const THEME_VARS = ['bg', 'surface', 'surface-2', 'border', 'fg', 'muted', 'accent', 'accent-fg', 'danger', 'radius', 'font'] as const
export type ThemeVar = (typeof THEME_VARS)[number]

export interface CustomTheme {
  id: string
  name: string
  /** Built-in theme to start from; only the overridden vars need to be set. */
  base: BuiltinThemeId
  vars: Partial<Record<ThemeVar, string>>
}

export const BUILTIN_THEMES = [
  { id: 'light', name: 'Light' },
  { id: 'dark', name: 'Dark' },
  { id: 'midnight', name: 'Midnight' },
  { id: 'sepia', name: 'Sepia' }
] as const
export type BuiltinThemeId = (typeof BUILTIN_THEMES)[number]['id']

/** 'system' follows prefers-color-scheme; anything else is a builtin or custom theme id. */
type ThemeChoice = 'system' | string

const STORAGE_KEY = 'abs-ui.theme'
const CUSTOM_KEY = 'abs-ui.customThemes'

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage unavailable (private mode); theme just won't persist
  }
}

interface ThemeContextValue {
  choice: ThemeChoice
  setChoice: (choice: ThemeChoice) => void
  customThemes: CustomTheme[]
  saveCustomTheme: (theme: CustomTheme) => void
  deleteCustomTheme: (id: string) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(() => readStorage(STORAGE_KEY, 'system'))
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>(() => readStorage(CUSTOM_KEY, []))
  const [prefersDark, setPrefersDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Apply: set data-theme to the builtin base, then layer custom vars inline on <html>.
  useEffect(() => {
    const root = document.documentElement
    for (const v of THEME_VARS) root.style.removeProperty(`--${v}`)

    const custom = customThemes.find((t) => t.id === choice)
    if (custom) {
      root.dataset.theme = custom.base
      for (const [k, val] of Object.entries(custom.vars)) if (val) root.style.setProperty(`--${k}`, val)
    } else if (choice === 'system' || !BUILTIN_THEMES.some((t) => t.id === choice)) {
      root.dataset.theme = prefersDark ? 'dark' : 'light'
    } else {
      root.dataset.theme = choice
    }
  }, [choice, customThemes, prefersDark])

  const setChoice = useCallback((c: ThemeChoice) => {
    setChoiceState(c)
    writeStorage(STORAGE_KEY, c)
  }, [])

  const saveCustomTheme = useCallback((theme: CustomTheme) => {
    setCustomThemes((prev) => {
      const next = [...prev.filter((t) => t.id !== theme.id), theme]
      writeStorage(CUSTOM_KEY, next)
      return next
    })
  }, [])

  const deleteCustomTheme = useCallback((id: string) => {
    setCustomThemes((prev) => {
      const next = prev.filter((t) => t.id !== id)
      writeStorage(CUSTOM_KEY, next)
      return next
    })
    setChoiceState((c) => (c === id ? 'system' : c))
  }, [])

  const value = useMemo(
    () => ({ choice, setChoice, customThemes, saveCustomTheme, deleteCustomTheme }),
    [choice, setChoice, customThemes, saveCustomTheme, deleteCustomTheme]
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
