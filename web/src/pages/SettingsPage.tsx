import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { BUILTIN_THEMES, THEME_VARS, useTheme, type BuiltinThemeId, type CustomTheme, type ThemeVar } from '../theme/ThemeProvider'
import { Button, Field, Input, Select, cn } from '../components/ui'

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

  function apply(next: CustomTheme) {
    setDraft(next)
    // Preview live while editing.
    saveCustomTheme(next)
    setChoice(next.id)
  }

  const isCustom = customThemes.some((t) => t.id === choice)

  return (
    <div className="max-w-2xl space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Theme</h2>
        <div role="radiogroup" aria-label="Theme" className="flex flex-wrap gap-2">
          {[{ id: 'system', name: 'System' }, ...BUILTIN_THEMES, ...customThemes].map((t) => (
            <Button
              key={t.id}
              role="radio"
              aria-checked={choice === t.id}
              variant={choice === t.id ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setChoice(t.id)}
            >
              {t.name}
            </Button>
          ))}
          <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} className="border border-dashed border-border text-muted" onClick={startNew}>
            Custom
          </Button>
        </div>
        {isCustom && !draft && (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" icon={<Pencil className="size-4" />} onClick={() => setDraft(customThemes.find((t) => t.id === choice)!)}>
              Edit
            </Button>
            <Button size="sm" variant="danger" icon={<Trash2 className="size-4" />} onClick={() => deleteCustomTheme(choice)}>
              Delete
            </Button>
          </div>
        )}
      </section>

      {draft && (
        <section aria-label="Custom theme editor" className="space-y-4 rounded-card border border-border bg-surface p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">{(a11y) => <Input {...a11y} value={draft.name} onChange={(e) => apply({ ...draft, name: e.target.value })} />}</Field>
            <Field label="Based on">
              {(a11y) => (
                <Select {...a11y} value={draft.base} onChange={(e) => apply({ ...draft, base: e.target.value as BuiltinThemeId })}>
                  {BUILTIN_THEMES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {COLOR_VARS.map((v) => (
              <label key={v} className="flex items-center gap-2 text-sm">
                <input
                  type="color"
                  className={cn('size-8 cursor-pointer rounded border border-border bg-transparent')}
                  value={toHex(currentValue(v))}
                  onChange={(e) => apply({ ...draft, vars: { ...draft.vars, [v]: e.target.value } })}
                />
                {v}
              </label>
            ))}
          </div>
          <Field label="Corner radius" className="w-32">
            {(a11y) => <Input {...a11y} value={currentValue('radius')} onChange={(e) => apply({ ...draft, vars: { ...draft.vars, radius: e.target.value } })} />}
          </Field>
          <Button variant="primary" onClick={() => setDraft(null)}>
            Done
          </Button>
        </section>
      )}
    </div>
  )
}

/** <input type=color> only accepts #rrggbb. */
function toHex(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'
}
