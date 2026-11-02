import { useState } from 'react'
import { BUILTIN_THEMES, THEME_VARS, useTheme, type BuiltinThemeId, type CustomTheme, type ThemeVar } from '../theme/ThemeProvider'

// Vars edited with a color picker; radius/font are free text.
const COLOR_VARS = THEME_VARS.filter((v) => v !== 'radius' && v !== 'font')

export function SettingsPage() {
  const { choice, setChoice, customThemes, saveCustomTheme, deleteCustomTheme } = useTheme()
  const [draft, setDraft] = useState<CustomTheme | null>(null)

  // Start from whatever builtin is currently applied so the swatches match what's on screen.
  function startNew() {
    const base = (document.documentElement.dataset.theme as BuiltinThemeId) ?? 'dark'
    const next: CustomTheme = { id: `custom-${Date.now()}`, name: 'My theme', base, vars: {} }
    setDraft(next)
    saveCustomTheme(next)
    setChoice(next.id)
  }

  function currentValue(v: ThemeVar) {
    return draft?.vars[v] ?? getComputedStyle(document.documentElement).getPropertyValue(`--${v}`).trim()
  }

  function setVar(v: ThemeVar, value: string) {
    if (!draft) return
    const next = { ...draft, vars: { ...draft.vars, [v]: value } }
    setDraft(next)
    // Preview live while editing.
    saveCustomTheme(next)
    setChoice(next.id)
  }

  return (
    <div className="max-w-2xl space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Theme</h2>
        <div className="flex flex-wrap gap-2">
          {[{ id: 'system', name: 'System' }, ...BUILTIN_THEMES, ...customThemes].map((t) => (
            <button
              key={t.id}
              onClick={() => setChoice(t.id)}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                choice === t.id ? 'border-accent bg-accent text-accent-fg' : 'border-border bg-surface'
              }`}
            >
              {t.name}
            </button>
          ))}
          <button onClick={startNew} className="rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-muted">
            + Custom
          </button>
        </div>
        {customThemes.some((t) => t.id === choice) && !draft && (
          <div className="flex gap-2 text-sm">
            <button className="text-accent" onClick={() => setDraft(customThemes.find((t) => t.id === choice)!)}>
              Edit
            </button>
            <button className="text-danger" onClick={() => deleteCustomTheme(choice)}>
              Delete
            </button>
          </div>
        )}
      </section>

      {draft && (
        <section className="space-y-4 rounded-card border border-border bg-surface p-4">
          <div className="flex flex-wrap gap-3">
            <input
              className="rounded-md border border-border bg-surface-2 px-2 py-1"
              value={draft.name}
              onChange={(e) => {
                const next = { ...draft, name: e.target.value }
                setDraft(next)
                saveCustomTheme(next)
              }}
            />
            <select
              className="rounded-md border border-border bg-surface-2 px-2 py-1"
              value={draft.base}
              onChange={(e) => {
                const next = { ...draft, base: e.target.value as BuiltinThemeId }
                setDraft(next)
                saveCustomTheme(next)
                setChoice(next.id)
              }}
            >
              {BUILTIN_THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  Based on {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {COLOR_VARS.map((v) => (
              <label key={v} className="flex items-center gap-2 text-sm">
                <input type="color" value={toHex(currentValue(v))} onChange={(e) => setVar(v, e.target.value)} />
                {v}
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            Corner radius
            <input
              className="w-20 rounded-md border border-border bg-surface-2 px-2 py-1"
              value={currentValue('radius')}
              onChange={(e) => setVar('radius', e.target.value)}
            />
          </label>
          <button className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-fg" onClick={() => setDraft(null)}>
            Done
          </button>
        </section>
      )}
    </div>
  )
}

/** <input type=color> only accepts #rrggbb. */
function toHex(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'
}
